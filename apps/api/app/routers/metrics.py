from __future__ import annotations

from fastapi import APIRouter, Query

from ..services.telemetry import list_events, list_feedback, summary

router = APIRouter()


@router.get("/metrics")
async def metrics(limit: int = Query(25, ge=1, le=200)):
    return {
        "summary": summary(),
        "events": list_events(limit),
        "feedback": list_feedback(25),
    }
