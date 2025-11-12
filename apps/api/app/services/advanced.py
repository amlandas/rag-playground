from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

import numpy as np

from ..config import settings
from ..schemas import AdvancedQueryResponse, AdvancedSubQuery
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
    ce_latency_ms: float


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
    ordered = sorted(
        merged.values(),
        key=lambda h: (h.rerank_score or 0.0, h.fused_score, h.dense_score),
        reverse=True,
    )
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
        ce_latency_ms=0.0,
    )
    return indexes, paths, diagnostics


def _prepare_retrieval(session_id: str, query: str, max_hops: int) -> Tuple[List[RetrievalHit], List[Dict[str, Any]], SubQueryDiagnostics]:
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
        answer_top_k=settings.ANSWER_TOP_K,
        mmr_lambda=settings.MMR_LAMBDA,
        use_mmr=settings.USE_MMR,
    )

    diagnostics.hybrid_candidates = len(hits_hybrid)
    graph_hits = _to_hits_from_indexes(graph_hits_indexes)
    merged_hits = graph_hits + hits_hybrid
    return merged_hits, graph_paths, diagnostics


def run_advanced_query(session_id: str, query: str, max_hops: int | None = None) -> AdvancedQueryResponse:
    if not settings.GRAPH_ENABLED:
        raise ValueError("Advanced graph mode is disabled.")
    sess = ensure_session(session_id)
    if not sess.get("index"):
        raise ValueError("No index for this session.")

    sidx = get_session_index(session_id)
    if not sidx or not sidx.faiss_index:
        raise ValueError("Index metadata unavailable.")

    hops = max_hops or settings.MAX_GRAPH_HOPS

    subqueries = plan_subqueries(query)
    if not subqueries:
        subqueries = [query]

    response_subqueries: List[AdvancedSubQuery] = []
    for sub_query in subqueries:
        hits, graph_paths, diagnostics = _prepare_retrieval(session_id, sub_query, hops)
        if not hits:
            response_subqueries.append(
                AdvancedSubQuery(
                    query=sub_query,
                    retrieved_meta=[],
                    graph_paths=graph_paths,
                    ce_rerank_scores=[],
                    metrics={
                        "hops_used": diagnostics.hops_used,
                        "graph_candidates": diagnostics.graph_candidates,
                        "hybrid_candidates": diagnostics.hybrid_candidates,
                        "ce_latency_ms": diagnostics.ce_latency_ms,
                    },
                )
            )
            continue

        rerank_start = time.perf_counter()
        rerank_result = _apply_rerank(sub_query, hits, sidx.texts or [])
        rerank_latency = (time.perf_counter() - rerank_start) * 1000.0
        diagnostics.ce_latency_ms = rerank_latency
        record_advanced_query(
            hops_used=diagnostics.hops_used,
            graph_candidates=diagnostics.graph_candidates,
            hybrid_candidates=diagnostics.hybrid_candidates,
            ce_latency_ms=rerank_latency,
        )

        chunk_map = sidx.chunk_map
        retrieved_meta: List[Dict[str, Any]] = []
        for rank, hit in enumerate(hits, start=1):
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
            if rank >= settings.MAX_RETRIEVED:
                break

        response_subqueries.append(
            AdvancedSubQuery(
                query=sub_query,
                retrieved_meta=retrieved_meta,
                graph_paths=graph_paths,
                ce_rerank_scores=rerank_result["scores"],
                metrics={
                    "hops_used": diagnostics.hops_used,
                    "graph_candidates": diagnostics.graph_candidates,
                    "hybrid_candidates": diagnostics.hybrid_candidates,
                    "ce_latency_ms": diagnostics.ce_latency_ms,
                },
            )
        )

    return AdvancedQueryResponse(
        session_id=session_id,
        query=query,
        subqueries=response_subqueries,
        planner={"subqueries": subqueries},
    )
