from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..schemas import AdvancedQueryRequest, AdvancedQueryResponse
from ..services.advanced import run_advanced_query
from ..services.runtime_config import get_runtime_config
from ..services.session_auth import SessionUser, get_session_user, maybe_require_auth

router = APIRouter()


@router.post("/query/advanced", response_model=AdvancedQueryResponse)
async def query_advanced(
    req: AdvancedQueryRequest,
    user: SessionUser | None = Depends(get_session_user),
):
    maybe_require_auth(user)
    runtime_cfg = get_runtime_config()
    if not runtime_cfg.features.graph_enabled:
        raise HTTPException(status_code=400, detail="Advanced graph mode is disabled.")
    if not req.session_id:
        raise HTTPException(status_code=400, detail="session_id is required.")
    if not req.query:
        raise HTTPException(status_code=400, detail="query is required.")
    try:
        result = run_advanced_query(req)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    return result
