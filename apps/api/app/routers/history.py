from __future__ import annotations

from typing import Any, List, Dict
from fastapi import APIRouter, Depends, HTTPException

import pydantic
from ..services.session import ensure_session, get_history, add_history_item
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


class RecordHistoryRequest(pydantic.BaseModel):
    session_id: str
    item: Dict[str, Any]


@router.post("/history/record")
async def record_history_item(
    body: RecordHistoryRequest,
    user: SessionUser = Depends(get_session_user),
):
    maybe_require_auth(user)
    try:
        add_history_item(body.session_id, body.item)
        return {"status": "ok"}
    except ValueError:
        raise HTTPException(status_code=404, detail="Session not found")


class VoteRequest(pydantic.BaseModel):
    session_id: str
    run_id: str
    vote: str  # "A", "B", "tie"
    reason: str | None = None


@router.post("/vote")
async def cast_vote(
    body: VoteRequest,
    user: SessionUser = Depends(get_session_user),
):
    maybe_require_auth(user)
    try:
        ensure_session(body.session_id)
        history = get_history(body.session_id)
        found = False
        for item in history:
            if item.get("run_id") == body.run_id:
                item["vote"] = body.vote
                found = True
                break
        
        return {"status": "ok", "updated": found}
    except ValueError:
        raise HTTPException(status_code=404, detail="Session not found")
