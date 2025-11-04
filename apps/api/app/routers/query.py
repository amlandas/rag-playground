from __future__ import annotations

import logging
import json
from time import perf_counter

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from ..config import settings
from ..schemas import QueryRequest
from ..services.compose import build_messages
from ..services.generate import stream_chat
from ..services.pipeline import prepare_answer_context, resolve_answer_mode
from ..services.session import ensure_session, incr_query
from ..services.telemetry import new_query_id, record_query_event
from ..services.tokenizer import estimate_tokens
from ..services.observability import record_query, record_query_error
from ..services.session_auth import SessionUser, get_session_user, maybe_require_auth

router = APIRouter()

logger = logging.getLogger(__name__)


def sse_wrap(prelude_obj, generator, on_complete):
    yield f"event: retrieved\ndata: {json.dumps(prelude_obj)}\n\n"
    collected: list[str] = []
    for token in generator:
        collected.append(token)
        yield f"data: {token}\n\n"
    yield "event: done\ndata: [DONE]\n\n"
    on_complete("".join(collected))


@router.post("/query")
async def query(
    req: QueryRequest,
    user: SessionUser | None = Depends(get_session_user),
):
    maybe_require_auth(user)
    try:
        sess = ensure_session(req.session_id)
        if not sess.get("index"):
            raise HTTPException(status_code=400, detail="No index for this session. Call /api/index first.")
        if int(sess.get("queries_used", 0)) >= settings.MAX_QUERIES_PER_SESSION:
            raise HTTPException(status_code=429, detail="Rate limit: session query cap reached")

        query_id = new_query_id()
        start = perf_counter()
        mode = resolve_answer_mode(req.mode)
        context = prepare_answer_context(
            req.session_id,
            req.query,
            req.k,
            req.similarity,
            mode,
            session=sess,
        )

        sources = context["sources"]
        citations = context["citations"]
        retrieved_meta = context["retrieved_meta"]
        top_similarity = context["top_similarity"]
        attempt = context["attempt"]
        floor = context["floor"]
        rerank_strategy = context["rerank_strategy"]
        rerank_scores = context["rerank_scores"]
        insufficient = context["insufficient"]
        hits = context["hits"]
        confidence = context["confidence"]

        logger.info(
            "[LOG RETRIEVE] %s",
            {
                "q": req.query,
                "strategy": settings.RETRIEVER_STRATEGY,
                "attempt": attempt,
                "floor": floor,
                "selected": [hit.idx for hit in hits],
                "dense_scores": [hit.dense_score for hit in hits],
                "lexical_scores": [hit.lexical_score for hit in hits],
                "fused_scores": [hit.fused_score for hit in hits],
                "rerank_strategy": rerank_strategy,
                "rerank_scores": rerank_scores or None,
                "mode": mode,
            },
        )

        incr_query(req.session_id)
        record_query(mode, confidence)

        def finish(output_text: str) -> None:
            latency_ms = (perf_counter() - start) * 1000.0
            record_query_event(
                {
                    "query_id": query_id,
                    "session_id": req.session_id,
                    "latency_ms": latency_ms,
                    "k": req.k,
                    "similarity_metric": req.similarity,
                    "top_similarity": top_similarity,
                    "model": req.model,
                    "temperature": req.temperature,
                    "prompt_tokens_est": estimate_tokens(req.query),
                    "output_tokens_est": estimate_tokens(output_text),
                }
            )

        prelude = {
            "query_id": query_id,
            "retrieved": retrieved_meta,
            "citations": citations,
            "mode": mode,
            "confidence": confidence,
        }

        def insufficient_stream():
            yield (
                "Uploaded documents do not contain enough information to answer this question. "
                "Add more relevant files or switch to Doc + world context mode."
            )

        if insufficient and mode == "grounded":
            return StreamingResponse(
                sse_wrap(prelude, insufficient_stream(), finish),
                media_type="text/event-stream",
            )

        messages = build_messages(req.query, sources, mode)
        temperature = req.temperature if req.temperature is not None else settings.ANSWER_TEMP
        max_tokens = settings.ANSWER_MAX_TOKENS if settings.ANSWER_MD else None

        gen = stream_chat(
            messages,
            model=req.model,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return StreamingResponse(
            sse_wrap(prelude, gen, finish),
            media_type="text/event-stream",
        )
    except HTTPException:
        record_query_error()
        raise
    except Exception:
        record_query_error()
        raise
