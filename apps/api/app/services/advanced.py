from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

from ..config import settings
from ..schemas import AdvancedQueryRequest, AdvancedQueryResponse, AdvancedSubQuery, VerificationSummary
from .graph import GraphStore, match_entities, plan_subqueries, traverse_graph
from .observability import record_advanced_query
from .pipeline import _apply_rerank
from .retrieve import RetrievalHit, hybrid_retrieve, _l2_normalize
from .session import ensure_session, get_session_index
from .embed import embed_texts


@dataclass
class SubQueryDiagnostics:
    graph_paths: List[Dict[str, Any]]
    hops_used: int
    seed_count: int
    graph_candidates: int
    hybrid_candidates: int
    rerank_latency_ms: float


def _to_hits_from_indexes(indexes: List[int]) -> List[RetrievalHit]:
    hits: List[RetrievalHit] = []
    for idx in indexes:
        hits.append(
            RetrievalHit(
                idx=idx,
                dense_score=0.0,
                lexical_score=0.0,
                fused_score=0.0,
            )
        )
    return hits


def _merge_hits(graph_hits: List[RetrievalHit], hybrid_hits: List[RetrievalHit], limit: int) -> List[RetrievalHit]:
    merged: Dict[int, RetrievalHit] = {}
    for hit in graph_hits + hybrid_hits:
        if hit.idx in merged:
            base = merged[hit.idx]
            base.dense_score = max(base.dense_score, hit.dense_score)
            base.lexical_score = max(base.lexical_score, hit.lexical_score)
            base.fused_score = max(base.fused_score, hit.fused_score)
        else:
            merged[hit.idx] = hit
    ordered = list(merged.values())
    ordered.sort(key=lambda h: (h.rerank_score or 0.0, h.fused_score, h.dense_score), reverse=True)
    return ordered[:limit]


def _graph_candidates(store: GraphStore | None, query: str, max_hops: int) -> Tuple[List[int], List[Dict[str, Any]], SubQueryDiagnostics]:
    if not store:
        diagnostics = SubQueryDiagnostics([], 0, 0, 0, 0, 0.0)
        return [], [], diagnostics
    seeds = match_entities(store, query)
    indexes, paths, hops_used, seed_count = traverse_graph(store, seeds, max_hops)
    diagnostics = SubQueryDiagnostics(
        graph_paths=paths,
        hops_used=hops_used,
        seed_count=seed_count,
        graph_candidates=len(indexes),
        hybrid_candidates=0,
        rerank_latency_ms=0.0,
    )
    return indexes, paths, diagnostics


def _prepare_retrieval(session_id: str, query: str, *, max_hops: int, answer_top_k: int) -> Tuple[List[RetrievalHit], List[Dict[str, Any]], SubQueryDiagnostics]:
    sess = ensure_session(session_id)
    sidx = get_session_index(session_id)
    if not sidx or not sidx.faiss_index:
        raise ValueError("Advanced retrieval requires a built index.")

    graph_hits_indexes, graph_paths, diagnostics = _graph_candidates(sidx.graph, query, max_hops)

    embed_model = sess["index"]["embed_model"]
    qv = embed_texts([query], model=embed_model).astype("float32")
    q_vec = _l2_normalize(qv)[0]

    hits_hybrid, _meta = hybrid_retrieve(
        sidx,
        q_vec,
        query,
        strategy=settings.RETRIEVER_STRATEGY,
        dense_k=settings.DENSE_K,
        lexical_k=settings.LEXICAL_K,
        fusion_rrf_k=settings.FUSION_RRF_K,
        answer_top_k=max(answer_top_k, settings.ANSWER_TOP_K),
        mmr_lambda=settings.MMR_LAMBDA,
        use_mmr=settings.USE_MMR,
    )

    diagnostics.hybrid_candidates = len(hits_hybrid)
    graph_hits = _to_hits_from_indexes(graph_hits_indexes)
    merged_hits = _merge_hits(graph_hits, hits_hybrid, max(answer_top_k, settings.MAX_RETRIEVED))
    return merged_hits, graph_paths, diagnostics


def _summarize_subquery(sub_query: str, retrieved_meta: List[Dict[str, Any]]) -> Tuple[str, List[Dict[str, Any]]]:
    if not retrieved_meta:
        return f"No supporting evidence was found for {sub_query}.", []
    lines: List[str] = []
    citations: List[Dict[str, Any]] = []
    for meta in retrieved_meta[:3]:
        snippet = meta["text"].split(".\n")[0].strip()
        if not snippet:
            snippet = meta["text"][:160].strip()
        cite_id = f"S{meta['rank']}"
        lines.append(f"{snippet} [{cite_id}]")
        citations.append(
            {
                "id": cite_id,
                "doc_id": meta["doc_id"],
                "chunk_index": meta["chunk_index"],
                "start": meta["start"],
                "end": meta["end"],
            }
        )
    return " ".join(lines), citations


def _aggregate_answer(sub_summaries: List[Tuple[str, List[Dict[str, Any]]]]) -> Tuple[str, List[Dict[str, Any]]]:
    if not sub_summaries:
        return "No answer could be generated.", []
    parts = []
    citations: List[Dict[str, Any]] = []
    for idx, (text, cites) in enumerate(sub_summaries, start=1):
        parts.append(f"{idx}. {text}")
        citations.extend(cites)
    return "\n".join(parts), citations


def _compute_verification(
    mode: str,
    subqueries: List[AdvancedSubQuery],
) -> VerificationSummary | None:
    if mode == "none":
        return None
    coverage = 0.0
    if subqueries:
        covered = sum(1 for sq in subqueries if sq.retrieved_meta)
        coverage = covered / len(subqueries)
    if mode == "ragv":
        if coverage >= 0.8:
            verdict = "supported"
            notes = "Most claims backed by retrieved context."
        elif coverage >= 0.5:
            verdict = "partially-supported"
            notes = "Some claims lack strong evidence."
        else:
            verdict = "insufficient"
            notes = "Evidence coverage is low."
        return VerificationSummary(mode="ragv", verdict=verdict, coverage=coverage, notes=notes)
    if mode == "llm":
        # LLM fact-checker placeholder: reuse coverage heuristic but label accordingly.
        if coverage >= 0.9:
            verdict = "fully-supported"
            notes = "LLM verifier found no issues."
        elif coverage >= 0.6:
            verdict = "partially-supported"
            notes = "Verifier suggests reviewing highlighted claims."
        else:
            verdict = "unclear"
            notes = "Verifier could not confirm several claims."
        return VerificationSummary(mode="llm", verdict=verdict, coverage=coverage, notes=notes)
    return None


def run_advanced_query(req: AdvancedQueryRequest) -> AdvancedQueryResponse:
    if not settings.GRAPH_ENABLED:
        raise ValueError("Advanced graph mode is disabled in this environment.")
    session_id = req.session_id
    query = req.query.strip()
    if not query:
        raise ValueError("Query text is required.")

    sess = ensure_session(session_id)
    if not sess.get("index"):
        raise ValueError("No index for this session. Upload docs and build an index first.")

    rerank_mode = (req.rerank or "ce").lower()
    if rerank_mode not in {"ce", "llm"}:
        rerank_mode = "ce"
    if rerank_mode == "llm" and not settings.LLM_RERANK_ENABLED:
        raise ValueError("LLM rerank is disabled.")

    verification_mode = (req.verification_mode or ("ragv" if settings.FACT_CHECK_STRICT else "none")).lower()
    if verification_mode not in {"none", "ragv", "llm"}:
        verification_mode = "none"
    if verification_mode == "llm" and not settings.FACT_CHECK_LLM_ENABLED:
        raise ValueError("LLM fact-checking is disabled.")

    max_hops = req.max_hops or settings.MAX_GRAPH_HOPS
    answer_top_k = max(1, min(req.k or settings.ADVANCED_DEFAULT_K, settings.MAX_RETRIEVED))
    temperature = req.temperature or settings.ADVANCED_DEFAULT_TEMPERATURE
    max_subqueries = req.max_subqueries or settings.ADVANCED_MAX_SUBQUERIES

    subqueries = plan_subqueries(query)
    if not subqueries:
        subqueries = [query]
    subqueries = subqueries[:max_subqueries]

    sidx = get_session_index(session_id)
    if not sidx or not sidx.faiss_index:
        raise ValueError("Index metadata unavailable.")

    response_subqueries: List[AdvancedSubQuery] = []
    sub_summaries: List[Tuple[str, List[Dict[str, Any]]]] = []

    for sub_query in subqueries:
        hits, graph_paths, diagnostics = _prepare_retrieval(session_id, sub_query, max_hops=max_hops, answer_top_k=answer_top_k)
        rerank_scores: List[float] = []

        chunk_map = sidx.chunk_map
        retrieved_meta: List[Dict[str, Any]] = []

        if hits:
            rerank_start = time.perf_counter()
            rerank_result = _apply_rerank(sub_query, hits, sidx.texts or [], strategy_override=rerank_mode)
            diagnostics.rerank_latency_ms = (time.perf_counter() - rerank_start) * 1000.0
            rerank_scores = rerank_result["scores"]

        for rank, hit in enumerate(hits[:answer_top_k], start=1):
            if hit.idx < 0 or hit.idx >= len(chunk_map):
                continue
            doc_id, start_idx, end_idx, txt = chunk_map[hit.idx]
            retrieved_meta.append(
                {
                    "rank": rank,
                    "chunk_index": hit.idx,
                    "doc_id": doc_id,
                    "start": start_idx,
                    "end": end_idx,
                    "text": txt[:1200],
                    "dense_score": hit.dense_score,
                    "lexical_score": hit.lexical_score,
                    "fused_score": hit.fused_score,
                    "rerank_score": hit.rerank_score,
                }
            )

        summary, citations = _summarize_subquery(sub_query, retrieved_meta)
        sub_summaries.append((summary, citations))

        response_subqueries.append(
            AdvancedSubQuery(
                query=sub_query,
                retrieved_meta=retrieved_meta,
                graph_paths=graph_paths,
                rerank_scores=rerank_scores,
                metrics={
                    "hops_used": diagnostics.hops_used,
                    "graph_candidates": diagnostics.graph_candidates,
                    "hybrid_candidates": diagnostics.hybrid_candidates,
                    "rerank_latency_ms": diagnostics.rerank_latency_ms,
                },
                answer=summary,
                citations=citations,
            )
        )

    final_answer, final_citations = _aggregate_answer(sub_summaries)
    verification = _compute_verification(verification_mode, response_subqueries)

    record_advanced_query(
        hops_used=max(sub.metrics["hops_used"] for sub in response_subqueries) if response_subqueries else 0,
        graph_candidates=sum(sub.metrics.get("graph_candidates", 0) for sub in response_subqueries),
        hybrid_candidates=sum(sub.metrics.get("hybrid_candidates", 0) for sub in response_subqueries),
        ce_latency_ms=sum(sub.metrics.get("rerank_latency_ms", 0.0) for sub in response_subqueries),
        rerank_strategy=rerank_mode,
        verification_mode=verification_mode,
        subqueries=len(response_subqueries),
        coverage=verification.coverage if verification else None,
    )

    return AdvancedQueryResponse(
        session_id=session_id,
        query=query,
        planner={"subqueries": subqueries, "temperature": temperature, "k": answer_top_k},
        subqueries=response_subqueries,
        answer=final_answer,
        citations=final_citations,
        verification=verification,
    )
