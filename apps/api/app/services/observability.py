from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Literal, Optional

from ..config import settings
from ..services.reranker import effective_strategy
from ..services.runtime_config import get_runtime_config, get_runtime_config_metadata


MetricsMode = Literal["grounded", "blended"]
MetricsConfidence = Literal["high", "medium", "low"]

_metrics_state = {
    "total_sessions": 0,
    "total_indices": 0,
    "total_queries": 0,
    "queries_by_mode": {
        "grounded": 0,
        "blended": 0,
    },
    "queries_by_confidence": {
        "high": 0,
        "medium": 0,
        "low": 0,
    },
    "last_query_ts": None,
    "last_error_ts": None,
    "advanced_graph": {
        "total_queries": 0,
        "last_hops_used": 0,
        "last_graph_candidates": 0,
        "last_hybrid_candidates": 0,
        "last_ce_latency_ms": None,
        "last_rerank_strategy": "ce",
        "last_verification_mode": "none",
        "last_subqueries": 0,
        "last_coverage": None,
    },
}


def _timestamp_to_iso(ts: Optional[float]) -> Optional[str]:
    if not ts:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def reset_metrics() -> None:
    """Reset metrics (primarily for tests)."""
    for key in ("total_sessions", "total_indices", "total_queries"):
        _metrics_state[key] = 0
    for mode in ("grounded", "blended"):
        _metrics_state["queries_by_mode"][mode] = 0
    for level in ("high", "medium", "low"):
        _metrics_state["queries_by_confidence"][level] = 0
    _metrics_state["last_query_ts"] = None
    _metrics_state["last_error_ts"] = None
    _metrics_state["advanced_graph"] = {
        "total_queries": 0,
        "last_hops_used": 0,
        "last_graph_candidates": 0,
        "last_hybrid_candidates": 0,
        "last_ce_latency_ms": None,
        "last_rerank_strategy": "ce",
        "last_verification_mode": "none",
        "last_subqueries": 0,
        "last_coverage": None,
    }


def record_session_created() -> None:
    _metrics_state["total_sessions"] += 1


def record_index_built() -> None:
    _metrics_state["total_indices"] += 1


def record_query(mode: Optional[str], confidence: Optional[str]) -> None:
    _metrics_state["total_queries"] += 1
    if mode in _metrics_state["queries_by_mode"]:
        _metrics_state["queries_by_mode"][mode] += 1
    if confidence in _metrics_state["queries_by_confidence"]:
        _metrics_state["queries_by_confidence"][confidence] += 1
    _metrics_state["last_query_ts"] = time.time()


def record_query_error() -> None:
    _metrics_state["last_error_ts"] = time.time()


def record_advanced_query(
    *,
    hops_used: int,
    graph_candidates: int,
    hybrid_candidates: int,
    ce_latency_ms: float,
    rerank_strategy: str,
    verification_mode: str,
    subqueries: int,
    coverage: float | None,
) -> None:
    stats = _metrics_state["advanced_graph"]
    stats["total_queries"] += 1
    stats["last_hops_used"] = hops_used
    stats["last_graph_candidates"] = graph_candidates
    stats["last_hybrid_candidates"] = hybrid_candidates
    stats["last_ce_latency_ms"] = ce_latency_ms
    stats["last_rerank_strategy"] = rerank_strategy
    stats["last_verification_mode"] = verification_mode
    stats["last_subqueries"] = subqueries
    stats["last_coverage"] = coverage


def get_metrics_summary() -> dict:
    # Copy to avoid external mutation
    runtime_cfg = get_runtime_config()
    runtime_meta = get_runtime_config_metadata()
    features = runtime_cfg.features
    graph_conf = runtime_cfg.graph_rag
    summary = {
        "total_sessions": _metrics_state["total_sessions"],
        "total_indices": _metrics_state["total_indices"],
        "total_queries": _metrics_state["total_queries"],
        "queries_by_mode": dict(_metrics_state["queries_by_mode"]),
        "queries_by_confidence": dict(_metrics_state["queries_by_confidence"]),
        "last_query_ts": _timestamp_to_iso(_metrics_state["last_query_ts"]),
        "last_error_ts": _timestamp_to_iso(_metrics_state["last_error_ts"]),
        "rerank_strategy_current": effective_strategy(),
        "rerank_strategy_configured": settings.RERANK_STRATEGY,
        "answer_mode_default": settings.ANSWER_MODE_DEFAULT,
        "graph_enabled": features.graph_enabled,
        "advanced_graph_enabled": features.graph_enabled,
        "advanced_llm_enabled": settings.advanced_llm_enabled,
        "llm_rerank_enabled": features.llm_rerank_enabled and settings.advanced_llm_enabled,
        "fact_check_llm_enabled": features.fact_check_llm_enabled and settings.advanced_llm_enabled,
        "fact_check_strict": features.fact_check_strict,
        "max_graph_hops": graph_conf.max_graph_hops,
        "advanced_max_subqueries": graph_conf.advanced_max_subqueries,
        "advanced_default_k": graph_conf.advanced_default_k,
        "advanced_default_temperature": graph_conf.advanced_default_temperature,
        "firestore_config_enabled": runtime_meta["firestore_config_enabled"],
        "runtime_config_source": runtime_meta["runtime_config_source"],
        "config_env": runtime_meta["config_env"],
        "advanced_graph": dict(_metrics_state["advanced_graph"]),
    }
    return summary
