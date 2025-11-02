from __future__ import annotations

import json
from time import perf_counter

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..config import settings
from ..schemas import QueryRequest
from ..services.embed import embed_texts
from ..services.generate import stream_answer
from ..services.index import search_index
from ..services.session import ensure_session, incr_query
from ..services.telemetry import new_query_id, record_query_event
from ..services.tokenizer import estimate_tokens

router = APIRouter()


def sse_wrap(prelude_obj, generator, on_complete):
    yield f"event: retrieved\ndata: {json.dumps(prelude_obj)}\n\n"
    collected: list[str] = []
    for token in generator:
        collected.append(token)
        yield f"data: {token}\n\n"
    yield "event: done\ndata: [DONE]\n\n"
    on_complete("".join(collected))


@router.post("/query")
async def query(req: QueryRequest):
    sess = ensure_session(req.session_id)
    if not sess.get("index"):
        raise HTTPException(status_code=400, detail="No index for this session. Call /api/index first.")
    if int(sess.get("queries_used", 0)) >= settings.MAX_QUERIES_PER_SESSION:
        raise HTTPException(status_code=429, detail="Rate limit: session query cap reached")

    idx = sess["index"]["faiss"]
    chunk_map = sess["index"]["chunk_map"]
    embed_model = sess["index"]["embed_model"]

    query_id = new_query_id()
    start = perf_counter()

    qv = embed_texts([req.query], model=embed_model)
    D, I = search_index(idx, qv, k=req.k, metric=req.similarity)

    snippets = []
    retrieved_meta = []
    top_similarity: float | None = None
    for rank, row_idx in enumerate(I[0], start=1):
        if row_idx < 0 or row_idx >= len(chunk_map):
            continue
        doc_id, start_idx, end_idx, txt = chunk_map[row_idx]
        similarity = float(D[0][rank - 1])
        if top_similarity is None:
            top_similarity = similarity
        snippets.append((rank, txt))
        retrieved_meta.append(
            {
                "rank": rank,
                "doc_id": doc_id,
                "start": start_idx,
                "end": end_idx,
                "text": txt[:1200],
                "similarity": similarity,
            }
        )

    incr_query(req.session_id)

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

    prelude = {"query_id": query_id, "retrieved": retrieved_meta}

    def insufficient_stream():
        yield "Insufficient context in the provided documents to answer confidently."

    if not snippets or (
        req.similarity != "l2"
        and top_similarity is not None
        and top_similarity < settings.MIN_RETRIEVAL_SIMILARITY
    ):
        return StreamingResponse(
            sse_wrap(prelude, insufficient_stream(), finish),
            media_type="text/event-stream",
        )

    gen = stream_answer(
        prompt=req.query,
        snippets=snippets,
        model=req.model,
        temperature=req.temperature,
    )
    return StreamingResponse(
        sse_wrap(prelude, gen, finish),
        media_type="text/event-stream",
    )
