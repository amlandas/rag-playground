from __future__ import annotations

from typing import Any, List, Dict
from fastapi import APIRouter, Depends, HTTPException

from ..services.session import ensure_session, get_history
from ..services.session_auth import SessionUser, get_session_user, maybe_require_auth

router = APIRouter()


@router.get("/history", response_model=List[Dict[str, Any]])
async def get_session_history(
    session_id: str,
    user: SessionUser | None = Depends(get_session_user),
):
    maybe_require_auth(user)
    try:
        ensure_session(session_id)
        history = get_history(session_id)
        # Return newest first
        return list(reversed(history))
    except ValueError:
        raise HTTPException(status_code=404, detail="Session not found or expired")
