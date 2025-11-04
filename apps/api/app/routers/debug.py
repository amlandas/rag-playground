from __future__ import annotations

import os
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from ..config import settings
from ..services.compose import build_messages
from ..services.pipeline import prepare_answer_context, resolve_answer_mode
from ..services.reranker import ce_available, ce_model_id, effective_strategy, llm_available
from ..services.session import ensure_session

router = APIRouter(prefix="/api/debug", tags=["debug"])


class DebugRetrieveRequest(BaseModel):
    session_id: str
    query: str
    k: int = settings.MAX_RETRIEVED
    similarity: Literal["cosine", "l2"] = "cosine"
    mode: Literal["grounded", "blended"] | None = None


class DebugComposeRequest(BaseModel):
    session_id: str
    query: str
    k: int | None = None
    similarity: Literal["cosine", "l2"] = "cosine"
    mode: Literal["grounded", "blended"] | None = None


@router.post("/retrieve")
def debug_retrieve(req: DebugRetrieveRequest):
    ensure_session(req.session_id)
    mode = resolve_answer_mode(req.mode)
    context = prepare_answer_context(
        req.session_id,
        req.query,
        req.k,
        req.similarity,
        mode,
    )

    return {
        "requested_k": req.k,
        "k": min(req.k, settings.ANSWER_TOP_K),
        "similarity_floor": context["floor"],
        "metric": req.similarity,
        "strategy": settings.RETRIEVER_STRATEGY,
        "reranked": bool(context["rerank_scores"]),
        "rerank_strategy": context["rerank_strategy"],
        "kept": getattr(settings, "RERANK_KEEP", settings.ANSWER_TOP_K),
        "rerank_scores": context["rerank_scores"] or None,
        "attempt": context["attempt"],
        "top_similarity": context["top_similarity"],
        "results": context["retrieved_meta"],
        "citations": context["citations"],
        "confidence": context["confidence"],
        "mode": mode,
    }


@router.post("/compose")
def debug_compose(req: DebugComposeRequest):
    ensure_session(req.session_id)
    k = req.k or settings.ANSWER_TOP_K
    mode = resolve_answer_mode(req.mode)
    context = prepare_answer_context(
        req.session_id,
        req.query,
        k,
        req.similarity,
        mode,
    )
    messages = build_messages(req.query, context["sources"], mode)
    return {
        "query": req.query,
        "source_ids": [src.id for src in context["sources"]],
        "source_snippets": [src.text for src in context["sources"]],
        "citations": context["citations"],
        "mode": mode,
        "confidence": context["confidence"],
        "composed_system_prompt": messages[0]["content"] if messages else "",
        "composed_messages_preview": messages,
        "insufficient": context["insufficient"],
    }


@router.post("/rerank")
def debug_rerank():
    """Return rerank configuration/availability flags."""
    strategy_effective = effective_strategy()
    ce_ok = ce_available()
    return {
        "strategy": strategy_effective,
        "strategy_configured": settings.RERANK_STRATEGY,
        "top_n": settings.RERANK_TOP_N,
        "keep": settings.RERANK_KEEP,
        "ce_available": ce_ok,
        "ce_model_id": ce_model_id() if ce_ok else None,
        "llm_available": llm_available(),
        "llm_model": settings.LLM_RERANK_MODEL,
    }


@router.post("/env")
def debug_env():
    # show what the process actually sees
    strategy_effective = effective_strategy()
    return {
        "strategy_effective": strategy_effective,
        "strategy_configured": settings.RERANK_STRATEGY,
        "raw_env": {
            "RERANK_STRATEGY": os.getenv("RERANK_STRATEGY"),
            "RERANK__STRATEGY": os.getenv("RERANK__STRATEGY"),
            "RAG_RERANK_STRATEGY": os.getenv("RAG_RERANK_STRATEGY"),
        },
        "availability": {
            "ce_available": ce_available(),
            "llm_available": llm_available(),
        },
        "rerank_config": {
            "top_n": settings.RERANK_TOP_N,
            "keep": settings.RERANK_KEEP,
            "ce_model": settings.CE_MODEL_NAME,
            "llm_model": settings.LLM_RERANK_MODEL,
            "llm_max_chars": settings.LLM_RERANK_MAX_CHARS,
            "strict": settings.RERANK_STRICT,
        },
    }
