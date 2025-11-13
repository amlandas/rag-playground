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
        "graph_enabled": settings.GRAPH_ENABLED,
        "advanced_graph_enabled": settings.advanced_graph_enabled,
        "advanced_llm_enabled": settings.advanced_llm_enabled,
        "llm_rerank_enabled": settings.LLM_RERANK_ENABLED,
        "fact_check_llm_enabled": settings.FACT_CHECK_LLM_ENABLED,
        "fact_check_strict": settings.FACT_CHECK_STRICT,
        "advanced_max_subqueries": settings.ADVANCED_MAX_SUBQUERIES,
        "advanced_default_k": settings.ADVANCED_DEFAULT_K,
        "advanced_default_temperature": settings.ADVANCED_DEFAULT_TEMPERATURE,
        "version": "local-dev",
    }
