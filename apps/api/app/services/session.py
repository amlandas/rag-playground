import time
import uuid
from typing import Any, Dict

from ..config import settings

_SESSIONS: Dict[str, Dict[str, Any]] = {}


def new_session() -> str:
    sid = str(uuid.uuid4())
    _SESSIONS[sid] = {
        "created": time.time(),
        "docs": {},
        "index": None,
        "queries_used": 0,
        "last_query_ts": None,
    }
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
