from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

_TRUE_VALUES = {"1", "true", "t", "yes", "y", "on"}
_FALSE_VALUES = {"0", "false", "f", "no", "n", "off"}


class GraphRagConfig(BaseModel):
    max_graph_hops: int = 2
    advanced_max_subqueries: int = 3
    advanced_default_k: int = 6
    advanced_default_temperature: float = 0.2


class FeatureFlags(BaseModel):
    graph_enabled: bool = False
    llm_rerank_enabled: bool = False
    fact_check_llm_enabled: bool = False
    fact_check_strict: bool = False


class RuntimeConfig(BaseModel):
    environment: str = "local"
    features: FeatureFlags = FeatureFlags()
    graph_rag: GraphRagConfig = GraphRagConfig()


_runtime_config_cache: RuntimeConfig | None = None
_runtime_config_source: str = "env"
_runtime_config_metadata: Dict[str, Any] = {
    "config_env": "local",
    "collection": "runtime_config",
    "firestore_config_enabled": False,
    "runtime_config_source": "env",
}
_test_override: RuntimeConfig | None = None

_FEATURE_FIELDS = (
    "graph_enabled",
    "llm_rerank_enabled",
    "fact_check_llm_enabled",
    "fact_check_strict",
)
_GRAPH_FIELDS = (
    "max_graph_hops",
    "advanced_max_subqueries",
    "advanced_default_k",
    "advanced_default_temperature",
)


def _env_bool(names: Tuple[str, ...], default: bool) -> bool:
    for name in names:
        raw = os.getenv(name)
        if raw is None:
            continue
        lowered = raw.strip().strip("'\"").strip().lower()
        if lowered in _TRUE_VALUES:
            return True
        if lowered in _FALSE_VALUES:
            return False
    return default


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw.strip())
    except ValueError:
        logger.warning("Invalid int for %s=%s; using default %s", name, raw, default)
        return default


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return float(raw.strip())
    except ValueError:
        logger.warning("Invalid float for %s=%s; using default %s", name, raw, default)
        return default


def _load_env_config(config_env: str) -> RuntimeConfig:
    features = FeatureFlags(
        graph_enabled=_env_bool(("GRAPH_ENABLED", "RAG_GRAPH_ENABLED"), False),
        llm_rerank_enabled=_env_bool(("LLM_RERANK_ENABLED", "RAG_LLM_RERANK_ENABLED"), False),
        fact_check_llm_enabled=_env_bool(("FACT_CHECK_LLM_ENABLED", "RAG_FACT_CHECK_LLM_ENABLED"), False),
        fact_check_strict=_env_bool(("FACT_CHECK_STRICT", "RAG_FACT_CHECK_STRICT"), False),
    )
    graph_config = GraphRagConfig(
        max_graph_hops=_env_int("MAX_GRAPH_HOPS", 2),
        advanced_max_subqueries=_env_int("ADVANCED_MAX_SUBQUERIES", 3),
        advanced_default_k=_env_int("ADVANCED_DEFAULT_K", 6),
        advanced_default_temperature=_env_float("ADVANCED_DEFAULT_TEMPERATURE", 0.2),
    )
    return RuntimeConfig(environment=config_env, features=features, graph_rag=graph_config)


def _fetch_firestore_document(collection: str, config_env: str) -> Optional[Dict[str, Any]]:
    from google.cloud import firestore

    client = firestore.Client()
    doc = client.collection(collection).document(config_env).get()
    if not doc.exists:
        return None
    return doc.to_dict()


def _detect_missing_fields(doc: Dict[str, Any]) -> List[str]:
    missing: List[str] = []
    features = doc.get("features") or {}
    for field in _FEATURE_FIELDS:
        if features.get(field) is None:
            missing.append(f"features.{field}")
    graph = doc.get("graph_rag") or {}
    for field in _GRAPH_FIELDS:
        if graph.get(field) is None:
            missing.append(f"graph_rag.{field}")
    return missing


def _deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            base[key] = _deep_merge(base[key], value)
        elif value is not None:
            base[key] = value
    return base


def _load_from_firestore(
    env_config: RuntimeConfig,
    config_env: str,
    collection: str,
) -> Tuple[Optional[RuntimeConfig], str]:
    try:
        doc = _fetch_firestore_document(collection, config_env)
    except Exception as exc:  # pragma: no cover - network/runtime failure
        logger.warning("Failed to load runtime config from Firestore: %s", exc)
        return None, "env"
    if not doc:
        logger.warning(
            "Runtime config document runtime_config/%s not found; using env defaults.",
            config_env,
        )
        return None, "env"
    missing = _detect_missing_fields(doc)
    if missing:
        logger.warning(
            "Runtime config document missing fields %s; falling back to env defaults for those values.",
            ", ".join(missing),
        )
    merged = _deep_merge(env_config.model_dump(), doc)
    merged.setdefault("environment", config_env)
    try:
        config = RuntimeConfig.model_validate(merged)
    except ValidationError as exc:
        logger.warning("Invalid runtime config document: %s; using env defaults.", exc)
        return None, "env"
    return config, "firestore"


def _compute_runtime_config() -> RuntimeConfig:
    global _runtime_config_source, _runtime_config_metadata

    config_env = os.getenv("CONFIG_ENV", "local")
    collection = os.getenv("RUNTIME_CONFIG_COLLECTION", "runtime_config")
    firestore_enabled = _env_bool(("FIRESTORE_CONFIG_ENABLED",), False)

    env_config = _load_env_config(config_env)
    metadata = {
        "config_env": config_env,
        "collection": collection,
        "firestore_config_enabled": firestore_enabled,
        "runtime_config_source": "env",
    }

    if firestore_enabled:
        firestore_config, source = _load_from_firestore(env_config, config_env, collection)
        if firestore_config:
            metadata["runtime_config_source"] = source
            _runtime_config_source = source
            _runtime_config_metadata = metadata
            logger.info("Loaded runtime config from Firestore env=%s collection=%s", config_env, collection)
            return firestore_config
        logger.warning("Firestore runtime config unavailable; continuing with env defaults.")

    _runtime_config_source = "env"
    _runtime_config_metadata = metadata
    if not firestore_enabled:
        logger.info("Firestore runtime config disabled; using env defaults.")
    return env_config


def get_runtime_config() -> RuntimeConfig:
    global _runtime_config_cache
    if _test_override is not None:
        return _test_override
    if _runtime_config_cache is None:
        _runtime_config_cache = _compute_runtime_config()
    return _runtime_config_cache


def reload_runtime_config() -> RuntimeConfig:
    global _runtime_config_cache
    _runtime_config_cache = None
    return get_runtime_config()


def get_runtime_config_metadata() -> Dict[str, Any]:
    if _test_override is not None:
        return {
            "config_env": _test_override.environment,
            "collection": "test-override",
            "firestore_config_enabled": False,
            "runtime_config_source": "test-override",
        }
    return dict(_runtime_config_metadata)


def override_runtime_config_for_tests(config: RuntimeConfig) -> None:
    global _test_override
    _test_override = config


def clear_runtime_config_override() -> None:
    global _test_override, _runtime_config_cache
    _test_override = None
    _runtime_config_cache = None

