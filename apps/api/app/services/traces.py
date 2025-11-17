from __future__ import annotations

import os
from collections import OrderedDict
from threading import Lock
from typing import Tuple

from ..schemas import GraphRagTrace


class TraceStore:
    """In-memory Graph RAG trace store (non-persistent, best-effort)."""

    def __init__(self, max_entries: int = 200):
        self._max_entries = max_entries
        self._lock = Lock()
        self._data: OrderedDict[Tuple[str, str], GraphRagTrace] = OrderedDict()

    def put(self, trace: GraphRagTrace) -> None:
        key = (trace.session_id, trace.request_id)
        with self._lock:
            self._data[key] = trace
            self._data.move_to_end(key)
            while len(self._data) > self._max_entries:
                self._data.popitem(last=False)

    def get(self, session_id: str, request_id: str) -> GraphRagTrace | None:
        key = (session_id, request_id)
        with self._lock:
            trace = self._data.get(key)
            if trace is not None:
                self._data.move_to_end(key)
            return trace

    def clear(self) -> None:
        with self._lock:
            self._data.clear()


def _default_cache_size() -> int:
    raw = os.getenv("GRAPH_TRACE_CACHE_SIZE")
    if not raw:
        return 200
    try:
        return max(20, int(raw))
    except ValueError:
        return 200


_TRACE_STORE = TraceStore(max_entries=_default_cache_size())


def store_trace(trace: GraphRagTrace) -> None:
    _TRACE_STORE.put(trace)


def get_trace(session_id: str, request_id: str) -> GraphRagTrace | None:
    return _TRACE_STORE.get(session_id, request_id)


def clear_traces() -> None:
    _TRACE_STORE.clear()
