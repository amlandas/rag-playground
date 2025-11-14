from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from ..services.telemetry import list_events, list_feedback, summary
from ..services.session_auth import SessionUser, get_session_user, require_admin
from ..services.observability import get_metrics_summary
from ..services.runtime_config import google_auth_enabled_effective

router = APIRouter()


@router.get("/metrics")
async def metrics(
    limit: int = Query(25, ge=1, le=200),
    user: SessionUser | None = Depends(get_session_user),
):
    if not google_auth_enabled_effective():
        raise HTTPException(status_code=403, detail="Auth disabled")
    require_admin(user)
    return {
        "summary": summary(),
        "events": list_events(limit),
        "feedback": list_feedback(25),
    }


@router.get("/metrics/summary")
async def metrics_summary(user: SessionUser | None = Depends(get_session_user)):
    if not google_auth_enabled_effective():
        raise HTTPException(status_code=403, detail="Auth disabled")
    require_admin(user)
    return get_metrics_summary()
