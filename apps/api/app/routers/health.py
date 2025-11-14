from fastapi import APIRouter

from ..config import settings
from ..services.reranker import ce_available, llm_available, effective_strategy
from ..services.runtime_config import get_runtime_config, get_runtime_config_metadata

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/health/details")
async def health_details():
    strategy_effective = effective_strategy()
    runtime_cfg = get_runtime_config()
    runtime_meta = get_runtime_config_metadata()
    features = runtime_cfg.features
    graph_conf = runtime_cfg.graph_rag
    llm_capable = settings.advanced_llm_enabled
    return {
        "status": "ok",
        "rerank_strategy_effective": strategy_effective,
        "rerank_strategy_configured": settings.RERANK_STRATEGY,
        "ce_available": ce_available(),
        "llm_available": llm_available(),
        "answer_mode_default": settings.ANSWER_MODE_DEFAULT,
        "google_auth_enabled": features.google_auth_enabled,
        "graph_enabled": features.graph_enabled,
        "advanced_graph_enabled": features.graph_enabled,
        "advanced_llm_enabled": llm_capable,
        "llm_rerank_enabled": features.llm_rerank_enabled and llm_capable,
        "fact_check_llm_enabled": features.fact_check_llm_enabled and llm_capable,
        "fact_check_strict": features.fact_check_strict,
        "max_graph_hops": graph_conf.max_graph_hops,
        "advanced_max_subqueries": graph_conf.advanced_max_subqueries,
        "advanced_default_k": graph_conf.advanced_default_k,
        "advanced_default_temperature": graph_conf.advanced_default_temperature,
        "firestore_config_enabled": runtime_meta["firestore_config_enabled"],
        "runtime_config_source": runtime_meta["runtime_config_source"],
        "config_env": runtime_meta["config_env"],
        "version": "local-dev",
    }
