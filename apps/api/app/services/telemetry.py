from __future__ import annotations

import time
import uuid
from typing import Any, Dict, List

_MAX_EVENTS = 200
_EVENTS: List[Dict[str, Any]] = []
_FEEDBACK: List[Dict[str, Any]] = []


def new_query_id() -> str:
    return str(uuid.uuid4())


def record_query_event(event: Dict[str, Any]) -> None:
    event["ts"] = time.time()
    _EVENTS.append(event)
    if len(_EVENTS) > _MAX_EVENTS:
        del _EVENTS[: len(_EVENTS) - _MAX_EVENTS]


def record_feedback(item: Dict[str, Any]) -> None:
    item["ts"] = time.time()
    _FEEDBACK.append(item)
    if len(_FEEDBACK) > _MAX_EVENTS:
        del _FEEDBACK[: len(_FEEDBACK) - _MAX_EVENTS]


def list_events(limit: int = 50) -> List[Dict[str, Any]]:
    return list(_EVENTS[-limit:])


def list_feedback(limit: int = 50) -> List[Dict[str, Any]]:
    return list(_FEEDBACK[-limit:])


def summary() -> Dict[str, Any]:
    if not _EVENTS:
        return {"count": 0, "avg_latency_ms": None, "avg_top_sim": None}
    latencies = [e.get("latency_ms") for e in _EVENTS if e.get("latency_ms") is not None]
    sims = [e.get("top_similarity") for e in _EVENTS if e.get("top_similarity") is not None]
    return {
        "count": len(_EVENTS),
        "avg_latency_ms": sum(latencies) / len(latencies) if latencies else None,
        "avg_top_sim": sum(sims) / len(sims) if sims else None,
        "by_model": _group_count("model"),
    }


def _group_count(field: str) -> Dict[str, int]:
    out: Dict[str, int] = {}
    for event in _EVENTS:
        value = event.get(field)
        if value is None:
            continue
        out[value] = out.get(value, 0) + 1
    return out
