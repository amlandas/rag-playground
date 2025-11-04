import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Optional

from ..config import settings
from .observability import record_session_created

_SESSIONS: Dict[str, Dict[str, Any]] = {}
_SESSION_INDEXES: Dict[str, "SessionIndex"] = {}


@dataclass
class SessionIndex:
    faiss_index: Any
    chunk_map: list[Any]
    embeddings: Any = None  # expected normalized np.ndarray
    texts: list[str] | None = None
    bm25: Any = None
    bm25_tokens: list[list[str]] | None = None
    embed_model: str | None = None


def set_session_index(sid: str, index: SessionIndex) -> None:
    _SESSION_INDEXES[sid] = index


def get_session_index(sid: str) -> Optional[SessionIndex]:
    return _SESSION_INDEXES.get(sid)


def new_session() -> str:
    sid = str(uuid.uuid4())
    _SESSIONS[sid] = {
        "created": time.time(),
        "docs": {},
        "index": None,
        "queries_used": 0,
        "last_query_ts": None,
    }
    record_session_created()
    return sid


def get_session(sid: str) -> Dict[str, Any] | None:
    return _SESSIONS.get(sid)


def ensure_session(sid: str) -> Dict[str, Any]:
    session = get_session(sid)
    if not session:
        raise ValueError("Invalid session_id")
    return session


def incr_query(sid: str) -> int:
    session = ensure_session(sid)
    session["queries_used"] = int(session.get("queries_used", 0)) + 1
    session["last_query_ts"] = time.time()
    return session["queries_used"]


def cleanup_expired_sessions() -> None:
    ttl = settings.SESSION_TTL_MINUTES * 60
    now = time.time()
    for sid in list(_SESSIONS.keys()):
        if now - _SESSIONS[sid]["created"] > ttl:
            del _SESSIONS[sid]
            _SESSION_INDEXES.pop(sid, None)
