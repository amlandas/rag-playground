from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..schemas import FeedbackRequest
from ..services.telemetry import record_feedback

router = APIRouter()


@router.post("/feedback")
async def feedback(req: FeedbackRequest):
    if req.rating not in (-1, 1):
        raise HTTPException(status_code=400, detail="rating must be -1 or +1")
    record_feedback(req.model_dump())
    return {"ok": True}
