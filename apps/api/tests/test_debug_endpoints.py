import importlib
import os
import sys

import pytest
from fastapi.testclient import TestClient

MODULES_TO_CLEAR = [
    "app.main",
    "app.config",
    "app.services.reranker",
    "app.services.retrieve",
    "app.services.session",
    "app.routers.debug",
]


def build_client(monkeypatch, strategy: str = "none") -> TestClient:
    monkeypatch.setenv("EMBEDDINGS_PROVIDER", "fake")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("RERANK_STRATEGY", strategy)
    monkeypatch.delenv("RERANK__STRATEGY", raising=False)
    monkeypatch.delenv("RAG_RERANK_STRATEGY", raising=False)
    monkeypatch.delenv("ANSWER_MODE_DEFAULT", raising=False)
    monkeypatch.delenv("ANSWER__MODE_DEFAULT", raising=False)
    monkeypatch.delenv("RAG_ANSWER_MODE_DEFAULT", raising=False)
    monkeypatch.delenv("ANSWER_CONFIDENCE_ENABLED", raising=False)
    monkeypatch.delenv("ANSWER__CONFIDENCE_ENABLED", raising=False)
    monkeypatch.delenv("RAG_ANSWER_CONFIDENCE_ENABLED", raising=False)
    for name in MODULES_TO_CLEAR:
        sys.modules.pop(name, None)
    app_module = importlib.import_module("app.main")
    return TestClient(app_module.app)


@pytest.fixture()
def client(monkeypatch):
    client = build_client(monkeypatch, strategy="none")
    try:
        yield client
    finally:
        client.close()


def test_debug_env_endpoint_returns_expected_keys(client):
    response = client.post("/api/debug/env")
    assert response.status_code == 200
    data = response.json()
    assert "strategy_effective" in data
    assert "raw_env" in data
    assert "availability" in data
    assert "rerank_config" in data
    assert "ce_available" in data["availability"]
    assert "llm_available" in data["availability"]


def test_debug_rerank_endpoint_returns_expected_keys(client):
    response = client.post("/api/debug/rerank")
    assert response.status_code == 200
    data = response.json()
    for key in ["strategy", "strategy_configured", "ce_available", "llm_available", "ce_model_id", "llm_model"]:
        assert key in data
