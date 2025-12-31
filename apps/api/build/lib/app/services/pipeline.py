from __future__ import annotations

from typing import Any, Dict, Literal, Optional

import numpy as np

from ..config import settings
from ..services.compose import citation_mapping, prepare_sources
from ..services.embed import embed_texts
from ..services.retrieve import RetrievalHit, _l2_normalize, hybrid_retrieve
from ..services.reranker import effective_strategy, rerank_ce, rerank_llm_openai
from ..services.session import ensure_session, get_session_index

AnswerMode = Literal["grounded", "blended"]


def resolve_answer_mode(requested: str | None) -> AnswerMode:
    if requested:
        lowered = requested.strip().lower()
        if lowered in {"grounded", "blended"}:
            return lowered  # type: ignore[return-value]
    return settings.ANSWER_MODE_DEFAULT  # type: ignore[return-value]


def compute_confidence(
    hits: list[RetrievalHit],
    floor: float,
    rerank_scores: list[float],
    insufficient: bool,
) -> Literal["high", "medium", "low"]:
    if insufficient or not hits:
        return "low"
    top = hits[0].dense_score if hits[0].dense_score is not None else 0.0
    fused_top = hits[0].fused_score if hits[0].fused_score is not None else 0.0
    support = sum(1 for hit in hits if hit.dense_score is not None and hit.dense_score >= floor)
    rerank_support = len([score for score in rerank_scores if score is not None])

    confidence_score = max(top, fused_top)
    if confidence_score >= (floor + 0.18) and support >= 3:
        return "high"
    if confidence_score >= (floor + 0.08) and (support >= 2 or rerank_support >= 2):
        return "medium"
    if confidence_score >= floor and (support >= 1 or rerank_support >= 1):
        return "medium"
    return "low"


def _apply_rerank(query: str, hits: list[RetrievalHit], texts: list[str], *, strategy_override: str | None = None) -> Dict[str, Any]:
    configured_strategy = strategy_override or settings.RERANK_STRATEGY
    rerank_strategy = (strategy_override or effective_strategy())
    rerank_scores: list[float] = []

    if rerank_strategy == "none" or not hits:
        return {"strategy": rerank_strategy, "scores": rerank_scores}

    candidates = [(hit.idx, texts[hit.idx]) for hit in hits if 0 <= hit.idx < len(texts)]
    reranked: Optional[list[tuple[int, float]]] = None

    if rerank_strategy == "ce":
        reranked = rerank_ce(
            query,
            candidates,
            top_n=getattr(settings, "RERANK_TOP_N", settings.MAX_RETRIEVED),
            keep=getattr(settings, "RERANK_KEEP", settings.ANSWER_TOP_K),
        )
    elif rerank_strategy == "llm":
        reranked = rerank_llm_openai(
            query,
            candidates,
            keep=getattr(settings, "RERANK_KEEP", settings.ANSWER_TOP_K),
            model=settings.LLM_RERANK_MODEL,
        )

    if not reranked:
        return {"strategy": rerank_strategy, "scores": rerank_scores}

    idx_to_hit = {hit.idx: hit for hit in hits}
    new_hits: list[RetrievalHit] = []
    for idx, score in reranked:
        base = idx_to_hit.get(idx)
        if base is None:
            continue
        new_hits.append(
            RetrievalHit(
                idx=idx,
                dense_score=base.dense_score,
                lexical_score=base.lexical_score,
                fused_score=base.fused_score,
                rerank_score=score,
            )
        )
        rerank_scores.append(score)

    if new_hits:
        hits[:] = new_hits

    return {"strategy": rerank_strategy, "scores": rerank_scores}


def prepare_answer_context(
    session_id: str,
    query_text: str,
    requested_k: int,
    similarity: str,
    mode: AnswerMode,
    *,
    session: dict | None = None,
) -> Dict[str, Any]:
    sess = session or ensure_session(session_id)
    if not sess.get("index"):
        raise ValueError("No index for this session. Call /api/index first.")

    embed_model = sess["index"]["embed_model"]
    sidx = get_session_index(session_id)
    if not sidx or not sidx.faiss_index:
        raise ValueError("Index metadata unavailable; rebuild the index and try again.")

    chunk_map = sidx.chunk_map

    qv = embed_texts([query_text], model=embed_model).astype("float32")
    q_vec = _l2_normalize(qv)[0]

    answer_top_k = min(max(requested_k, settings.ANSWER_TOP_K), settings.MAX_RETRIEVED)

    hits, retrieval_meta = hybrid_retrieve(
        sidx,
        q_vec,
        query_text,
        strategy=settings.RETRIEVER_STRATEGY,
        dense_k=settings.DENSE_K,
        lexical_k=settings.LEXICAL_K,
        fusion_rrf_k=settings.FUSION_RRF_K,
        answer_top_k=answer_top_k,
        mmr_lambda=settings.MMR_LAMBDA,
        use_mmr=settings.USE_MMR,
    )

    top_similarity: float | None = hits[0].dense_score if hits else None
    attempt = "primary"
    floor = settings.SIMILARITY_FLOOR

    if not hits or (
        similarity != "l2"
        and top_similarity is not None
        and top_similarity < floor
    ):
        attempt = "fallback"
        hits, retrieval_meta = hybrid_retrieve(
            sidx,
            q_vec,
            query_text,
            strategy=settings.RETRIEVER_STRATEGY,
            dense_k=settings.DENSE_K + settings.FALLBACK_WIDEN_K,
            lexical_k=settings.LEXICAL_K + settings.FALLBACK_WIDEN_K,
            fusion_rrf_k=settings.FUSION_RRF_K,
            answer_top_k=answer_top_k,
            mmr_lambda=settings.MMR_LAMBDA,
            use_mmr=settings.USE_MMR,
        )
        top_similarity = hits[0].dense_score if hits else top_similarity

    rerank_result = _apply_rerank(query_text, hits, sidx.texts or [])
    rerank_strategy = rerank_result["strategy"]
    rerank_scores = rerank_result["scores"]

    sources, citation_lookup = prepare_sources(hits, chunk_map, settings.ANSWER_TOP_K)
    citations = citation_mapping(sources)

    retrieved_meta = []
    for rank, hit in enumerate(hits, start=1):
        if hit.idx < 0 or hit.idx >= len(chunk_map):
            continue
        doc_id, start_idx, end_idx, txt = chunk_map[hit.idx]
        citation_id = citation_lookup.get(hit.idx)
        retrieved_meta.append(
            {
                "rank": rank,
                "chunk_index": hit.idx,
                "doc_id": doc_id,
                "start": start_idx,
                "end": end_idx,
                "text": txt[:1200],
                "similarity": hit.dense_score,
                "lexical_score": hit.lexical_score,
                "fused_score": hit.fused_score,
                "rerank_score": hit.rerank_score,
                "citation_id": citation_id,
            }
        )
        if rank >= settings.MAX_RETRIEVED:
            break

    insufficient = not sources or (
        similarity != "l2"
        and top_similarity is not None
        and top_similarity < floor
    )

    confidence_value: Literal["high", "medium", "low"] | None = None
    if settings.ANSWER_CONFIDENCE_ENABLED:
        confidence_value = compute_confidence(hits, floor, rerank_scores, insufficient)

    return {
        "session": sess,
        "chunk_map": chunk_map,
        "hits": hits,
        "sources": sources,
        "citations": citations,
        "retrieved_meta": retrieved_meta,
        "top_similarity": top_similarity,
        "attempt": attempt,
        "floor": floor,
        "rerank_strategy": rerank_strategy,
        "rerank_scores": rerank_scores,
        "insufficient": insufficient,
        "mode": mode,
        "confidence": confidence_value,
    }
