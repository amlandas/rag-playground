from fastapi import APIRouter

from ..config import settings
from ..services.reranker import ce_available, llm_available, effective_strategy

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/health/details")
async def health_details():
    strategy_effective = effective_strategy()
    return {
        "status": "ok",
        "rerank_strategy_effective": strategy_effective,
        "rerank_strategy_configured": settings.RERANK_STRATEGY,
        "ce_available": ce_available(),
        "llm_available": llm_available(),
        "answer_mode_default": settings.ANSWER_MODE_DEFAULT,
        "version": "local-dev",
    }
