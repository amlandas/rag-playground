from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple
import uuid

from ..config import settings
from ..schemas import (
    AdvancedQueryRequest,
    AdvancedQueryResponse,
    AdvancedSubQuery,
    GraphRagTrace,
    GraphRagTracePlannerStep,
    GraphRagTraceRetrievalHit,
    GraphRagTraceSynthesisNote,
    GraphRagTraceVerificationResult,
    VerificationSummary,
)
from .embed import embed_texts
from .generate import run_chat_completion
from .graph import GraphStore, match_entities, plan_subqueries, traverse_graph
from .observability import record_advanced_query
from .runtime_config import get_runtime_config
from .pipeline import _apply_rerank
from .retrieve import RetrievalHit, hybrid_retrieve, _l2_normalize
from .session import ensure_session, get_session_index

logger = logging.getLogger(__name__)
TRACE_MAX_HITS = 12


def _short_snippet(text: str, limit: int = 200) -> str:
    snippet = (text or "").replace("\n", " ").strip()
    if len(snippet) <= limit:
        return snippet
    return snippet[: limit - 1].rstrip() + "…"


def _map_verification_to_trace(summary: VerificationSummary | None) -> GraphRagTraceVerificationResult | None:
    if not summary:
        return None
    verdict = summary.verdict.lower()
    if verdict in {"supported", "fully-supported"}:
        mapped = "pass"
    elif verdict in {"partially-supported"}:
        mapped = "weak"
    else:
        mapped = "fail"
    return GraphRagTraceVerificationResult(verdict=mapped, reason=summary.notes)


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
#
# Summarization helpers
#


def _llm_capable() -> bool:
    return settings.advanced_llm_enabled


def _build_citations(retrieved_meta: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    citations: List[Dict[str, Any]] = []
    for meta in retrieved_meta[:3]:
        citations.append(
            {
                "id": f"S{meta['rank']}",
                "doc_id": meta["doc_id"],
                "chunk_index": meta["chunk_index"],
                "start": meta["start"],
                "end": meta["end"],
            }
        )
    return citations


def _prepare_snippets(retrieved_meta: List[Dict[str, Any]], citations: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    snippets: List[Dict[str, str]] = []
    for meta, cite in zip(retrieved_meta, citations):
        snippets.append(
            {
                "id": cite["id"],
                "text": meta["text"][:600],
            }
        )
    return snippets


def _summarize_subquery_fallback(sub_query: str, retrieved_meta: List[Dict[str, Any]], citations: List[Dict[str, Any]]) -> Tuple[str, List[Dict[str, Any]]]:
    if not retrieved_meta:
        return f"No supporting evidence was found for {sub_query}.", []
    lines: List[str] = []
    for meta, cite in zip(retrieved_meta[: len(citations)], citations):
        snippet = meta["text"].split(".\n")[0].strip()
        if not snippet:
            snippet = meta["text"][:160].strip()
        lines.append(f"{snippet} [{cite['id']}]")
    return " ".join(lines), citations


def _summarize_subquery_llm(
    sub_query: str,
    snippets: List[Dict[str, str]],
    *,
    model: str,
    temperature: float,
) -> str:
    if not snippets:
        return f"No supporting evidence was found for {sub_query}."
    payload = {
        "sub_query": sub_query,
        "snippets": snippets,
        "instructions": {
            "style": "concise",
            "citations": "Use [S#] referencing the provided snippet ids.",
        },
    }
    messages = [
        {
            "role": "system",
            "content": (
                "You summarize retrieved context for multi-hop retrieval. "
                "Use only the provided snippets. Answer in 2-3 sentences, cite snippets like [S1][S2], "
                "and never invent new snippet identifiers."
            ),
        },
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
    ]
    return run_chat_completion(messages, model=model, temperature=temperature, max_tokens=220)


def _summarize_subquery(
    sub_query: str,
    retrieved_meta: List[Dict[str, Any]],
    *,
    model: str,
    temperature: float,
) -> Tuple[str, List[Dict[str, Any]]]:
    citations = _build_citations(retrieved_meta)
    if not citations:
        return f"No supporting evidence was found for {sub_query}.", []
    snippets = _prepare_snippets(retrieved_meta, citations)
    if _llm_capable():
        try:
            summary = _summarize_subquery_llm(sub_query, snippets, model=model, temperature=temperature)
            return summary, citations
        except Exception as exc:  # pragma: no cover - defensive log
            logger.warning("Advanced sub-query summary LLM failed; falling back. err=%s", exc)
    return _summarize_subquery_fallback(sub_query, retrieved_meta, citations)


def _collect_citations(subqueries: List[AdvancedSubQuery]) -> List[Dict[str, Any]]:
    dedup: Dict[str, Dict[str, Any]] = {}
    for sub in subqueries:
        for cite in sub.citations:
            dedup.setdefault(cite["id"], cite)
    return list(dedup.values())


def _fallback_aggregate_answer(subqueries: List[AdvancedSubQuery]) -> Tuple[str, List[Dict[str, Any]]]:
    if not subqueries:
        return "No answer could be generated.", []
    parts: List[str] = []
    for idx, sub in enumerate(subqueries, start=1):
        parts.append(f"{idx}. {sub.answer}")
    return "\n".join(parts), _collect_citations(subqueries)


def _synthesize_answer_llm(
    question: str,
    subqueries: List[AdvancedSubQuery],
    *,
    model: str,
    temperature: float,
) -> Tuple[str, List[Dict[str, Any]]]:
    payload = {
        "question": question,
        "subqueries": [
            {
                "query": sub.query,
                "answer": sub.answer,
                "citations": [cite["id"] for cite in sub.citations],
            }
            for sub in subqueries
        ],
    }
    messages = [
        {
            "role": "system",
            "content": (
                "You are a synthesis planner for multi-hop RAG. Combine the provided sub-query answers into a single, "
                "well-structured response. Keep citations from the input answers (e.g., [S1]) exactly as provided "
                "and do not invent new identifiers."
            ),
        },
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
    ]
    answer = run_chat_completion(messages, model=model, temperature=temperature, max_tokens=500)
    return answer, _collect_citations(subqueries)


def _aggregate_answer(
    question: str,
    subqueries: List[AdvancedSubQuery],
    *,
    model: str,
    temperature: float,
) -> Tuple[str, List[Dict[str, Any]]]:
    if not subqueries:
        return "No answer could be generated.", []
    if _llm_capable():
        try:
            return _synthesize_answer_llm(question, subqueries, model=model, temperature=temperature)
        except Exception as exc:  # pragma: no cover - defensive log
            logger.warning("Advanced synthesis LLM failed; using fallback. err=%s", exc)
    return _fallback_aggregate_answer(subqueries)


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
    runtime_cfg = get_runtime_config()
    features = runtime_cfg.features
    graph_cfg = runtime_cfg.graph_rag
    request_id = uuid.uuid4().hex

    if not features.graph_enabled:
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
    llm_rerank_allowed = features.llm_rerank_enabled and settings.advanced_llm_enabled
    if rerank_mode == "llm" and not llm_rerank_allowed:
        raise ValueError("LLM rerank is disabled.")

    default_verification = "ragv" if features.fact_check_strict else "none"
    verification_mode = (req.verification_mode or default_verification).lower()
    if verification_mode not in {"none", "ragv", "llm"}:
        verification_mode = "none"
    llm_verification_allowed = features.fact_check_llm_enabled and settings.advanced_llm_enabled
    if verification_mode == "llm" and not llm_verification_allowed:
        raise ValueError("LLM fact-checking is disabled.")

    max_hops = req.max_hops or graph_cfg.max_graph_hops
    answer_top_k = max(1, min(req.k or graph_cfg.advanced_default_k, settings.MAX_RETRIEVED))
    temperature = req.temperature or graph_cfg.advanced_default_temperature
    max_subqueries = req.max_subqueries or graph_cfg.advanced_max_subqueries
    model = (req.model or settings.LLM_RERANK_MODEL or "gpt-4o-mini").strip()
    if not model:
        model = "gpt-4o-mini"
    summary_temperature = max(0.0, min(temperature, 0.6))

    subqueries = plan_subqueries(query)
    if not subqueries:
        subqueries = [query]
    subqueries = subqueries[:max_subqueries]
    trace_planner_steps = [
        GraphRagTracePlannerStep(subquery=text, hop=idx, notes=None) for idx, text in enumerate(subqueries)
    ]

    sidx = get_session_index(session_id)
    if not sidx or not sidx.faiss_index:
        raise ValueError("Index metadata unavailable.")

    response_subqueries: List[AdvancedSubQuery] = []
    trace_retrieval_hits: List[GraphRagTraceRetrievalHit] = []
    trace_warnings: List[str] = []
    trace_synthesis_notes: List[GraphRagTraceSynthesisNote] = []

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

        summary, citations = _summarize_subquery(sub_query, retrieved_meta, model=model, temperature=summary_temperature)

        if retrieved_meta:
            if len(trace_retrieval_hits) < TRACE_MAX_HITS:
                remaining = TRACE_MAX_HITS - len(trace_retrieval_hits)
                for meta in retrieved_meta[:remaining]:
                    trace_retrieval_hits.append(
                        GraphRagTraceRetrievalHit(
                            doc_id=meta["doc_id"],
                            source=meta["doc_id"],
                            score=meta.get("rerank_score") or meta.get("fused_score"),
                            rank=meta["rank"],
                            snippet=_short_snippet(meta["text"]),
                        )
                    )
        else:
            trace_warnings.append(f"No evidence retrieved for sub-query '{sub_query}'.")

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

    final_answer, final_citations = _aggregate_answer(query, response_subqueries, model=model, temperature=temperature)
    verification = _compute_verification(verification_mode, response_subqueries)

    total_hops_used = max((sub.metrics.get("hops_used", 0) for sub in response_subqueries), default=0)
    total_graph_candidates = sum(sub.metrics.get("graph_candidates", 0) for sub in response_subqueries)
    total_hybrid_candidates = sum(sub.metrics.get("hybrid_candidates", 0) for sub in response_subqueries)
    total_rerank_latency = sum(sub.metrics.get("rerank_latency_ms", 0.0) for sub in response_subqueries)

    record_advanced_query(
        hops_used=total_hops_used,
        graph_candidates=total_graph_candidates,
        hybrid_candidates=total_hybrid_candidates,
        ce_latency_ms=total_rerank_latency,
        rerank_strategy=rerank_mode,
        verification_mode=verification_mode,
        subqueries=len(response_subqueries),
        coverage=verification.coverage if verification else None,
    )

    logger.info(
        "[ADVANCED_GRAPH_RUN] %s",
        {
            "session_id": session_id,
            "query_len": len(query),
            "subqueries": len(response_subqueries),
            "graph_enabled": features.graph_enabled,
            "llm_summary": settings.advanced_llm_enabled,
            "rerank_mode": rerank_mode,
            "verification_mode": verification_mode,
            "verification_verdict": getattr(verification, "verdict", None),
            "max_hops": max_hops,
            "hops_used": total_hops_used,
            "graph_candidates": total_graph_candidates,
            "hybrid_candidates": total_hybrid_candidates,
            "rerank_latency_ms": round(total_rerank_latency, 2),
            "answer_chars": len(final_answer),
        },
    )

    trace_verification = _map_verification_to_trace(verification)
    trace_synthesis_notes.append(
        GraphRagTraceSynthesisNote(
            step="initial_answer",
            notes=f"Combined {len(response_subqueries)} sub-queries with rerank='{rerank_mode}'.",
        )
    )
    if verification:
        trace_synthesis_notes.append(
            GraphRagTraceSynthesisNote(
                step="verification",
                notes=f"Verification mode '{verification.mode}' produced verdict '{verification.verdict}'.",
            )
        )
        if trace_verification and trace_verification.verdict != "pass":
            trace_warnings.append("Verification indicated the answer may need review.")

    trace_payload = GraphRagTrace(
        request_id=request_id,
        mode="graph_advanced",
        planner_steps=trace_planner_steps,
        retrieval_hits=trace_retrieval_hits,
        verification=trace_verification,
        synthesis_notes=trace_synthesis_notes,
        warnings=trace_warnings,
    )

    return AdvancedQueryResponse(
        session_id=session_id,
        query=query,
        planner={
            "subqueries": subqueries,
            "temperature": temperature,
            "k": answer_top_k,
            "llm_summary_enabled": settings.advanced_llm_enabled,
            "model": model,
        },
        subqueries=response_subqueries,
        answer=final_answer,
        citations=final_citations,
        verification=verification,
        trace=trace_payload,
    )
