from __future__ import annotations

import os

from app.services import runtime_config


def test_runtime_config_env_fallback(monkeypatch):
    runtime_config.clear_runtime_config_override()
    monkeypatch.setenv("FIRESTORE_CONFIG_ENABLED", "false")
    monkeypatch.setenv("GRAPH_ENABLED", "true")
    monkeypatch.setenv("MAX_GRAPH_HOPS", "5")
    runtime_config.reload_runtime_config()

    cfg = runtime_config.get_runtime_config()
    assert cfg.features.google_auth_enabled is False
    assert cfg.features.graph_enabled is True
    assert cfg.graph_rag.max_graph_hops == 5
    assert cfg.environment == os.getenv("CONFIG_ENV", "local")

    monkeypatch.delenv("GRAPH_ENABLED", raising=False)
    monkeypatch.delenv("MAX_GRAPH_HOPS", raising=False)
    monkeypatch.delenv("FIRESTORE_CONFIG_ENABLED", raising=False)
    runtime_config.reload_runtime_config()


def test_runtime_config_firestore_override(monkeypatch):
    runtime_config.clear_runtime_config_override()
    monkeypatch.setenv("FIRESTORE_CONFIG_ENABLED", "true")
    monkeypatch.setenv("CONFIG_ENV", "unit")
    monkeypatch.setenv("ADVANCED_MAX_SUBQUERIES", "4")

    def fake_fetch(collection: str, env_name: str):
        assert collection == "runtime_config"
        assert env_name == "unit"
        return {
            "environment": env_name,
            "features": {"graph_enabled": True, "llm_rerank_enabled": True},
            "graph_rag": {"max_graph_hops": 7, "advanced_default_k": 9},
        }

    monkeypatch.setattr(runtime_config, "_fetch_firestore_document", fake_fetch)
    runtime_config.reload_runtime_config()

    cfg = runtime_config.get_runtime_config()
    assert cfg.environment == "unit"
    assert cfg.features.graph_enabled is True
    assert cfg.features.llm_rerank_enabled is True
    # Missing fields fall back to env default (ADVANCED_MAX_SUBQUERIES set above)
    assert cfg.graph_rag.advanced_max_subqueries == 4
    assert cfg.graph_rag.max_graph_hops == 7
    assert cfg.graph_rag.advanced_default_k == 9

    metadata = runtime_config.get_runtime_config_metadata()
    assert metadata["runtime_config_source"] == "firestore"
    assert metadata["config_env"] == "unit"

    monkeypatch.delenv("FIRESTORE_CONFIG_ENABLED", raising=False)
    monkeypatch.delenv("CONFIG_ENV", raising=False)
    monkeypatch.delenv("ADVANCED_MAX_SUBQUERIES", raising=False)
    runtime_config.reload_runtime_config()


def test_runtime_config_firestore_flat_document(monkeypatch):
    runtime_config.clear_runtime_config_override()
    monkeypatch.setenv("FIRESTORE_CONFIG_ENABLED", "true")
    monkeypatch.setenv("CONFIG_ENV", "prod")

    def fake_fetch(collection: str, env_name: str):
        return {
            "environment": env_name,
            "graph_enabled": True,
            "llm_rerank_enabled": True,
            "fact_check_llm_enabled": False,
            "fact_check_strict": False,
            "max_graph_hops": 5,
            "advanced_default_k": 9,
            "advanced_max_subqueries": 6,
            "advanced_default_temperature": 0.33,
        }

    monkeypatch.setattr(runtime_config, "_fetch_firestore_document", fake_fetch)
    runtime_config.reload_runtime_config()

    cfg = runtime_config.get_runtime_config()
    assert cfg.features.graph_enabled is True
    assert cfg.features.llm_rerank_enabled is True
    assert cfg.graph_rag.max_graph_hops == 5
    assert cfg.graph_rag.advanced_default_k == 9
    assert cfg.graph_rag.advanced_max_subqueries == 6
    assert abs(cfg.graph_rag.advanced_default_temperature - 0.33) < 1e-9

    metadata = runtime_config.get_runtime_config_metadata()
    assert metadata["runtime_config_source"] == "firestore"
    assert metadata["config_env"] == "prod"

    monkeypatch.delenv("FIRESTORE_CONFIG_ENABLED", raising=False)
    monkeypatch.delenv("CONFIG_ENV", raising=False)
    runtime_config.reload_runtime_config()


def test_runtime_config_google_auth_env_override(monkeypatch):
    runtime_config.clear_runtime_config_override()
    monkeypatch.setenv("FIRESTORE_CONFIG_ENABLED", "false")
    monkeypatch.setenv("GOOGLE_AUTH_ENABLED", "true")
    runtime_config.reload_runtime_config()
    cfg = runtime_config.get_runtime_config()
    assert cfg.features.google_auth_enabled is True
    assert runtime_config.google_auth_enabled_effective() is True
    monkeypatch.delenv("FIRESTORE_CONFIG_ENABLED", raising=False)
    monkeypatch.delenv("GOOGLE_AUTH_ENABLED", raising=False)
    runtime_config.reload_runtime_config()


def test_graph_traces_flag_env_override(monkeypatch):
    runtime_config.clear_runtime_config_override()
    monkeypatch.setenv("FIRESTORE_CONFIG_ENABLED", "false")
    monkeypatch.setenv("GRAPH_TRACES_ENABLED", "false")
    runtime_config.reload_runtime_config()
    assert runtime_config.graph_traces_enabled_effective() is False
    monkeypatch.setenv("GRAPH_TRACES_ENABLED", "true")
    runtime_config.reload_runtime_config()
    assert runtime_config.graph_traces_enabled_effective() is True
    monkeypatch.delenv("GRAPH_TRACES_ENABLED", raising=False)
    monkeypatch.delenv("FIRESTORE_CONFIG_ENABLED", raising=False)
    runtime_config.reload_runtime_config()
