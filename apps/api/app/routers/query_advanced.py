from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..schemas import AdvancedQueryRequest, AdvancedQueryResponse, GraphRagTrace
from ..services.advanced import run_advanced_query
from ..services.runtime_config import get_runtime_config
from ..services.session_auth import SessionUser, get_session_user, maybe_require_auth
from ..services.traces import get_trace

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


@router.get("/query/advanced/trace/{session_id}/{request_id}", response_model=GraphRagTrace)
async def get_advanced_trace(
    session_id: str,
    request_id: str,
    user: SessionUser | None = Depends(get_session_user),
):
    maybe_require_auth(user)
    runtime_cfg = get_runtime_config()
    features = runtime_cfg.features
    if not features.graph_enabled:
        raise HTTPException(status_code=404, detail="Advanced graph mode is disabled.")
    if not features.graph_traces_enabled:
        raise HTTPException(status_code=404, detail="Graph RAG trace capture is disabled.")
    trace = get_trace(session_id, request_id)
    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found.")
    return trace
