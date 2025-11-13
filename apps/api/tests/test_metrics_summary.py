from __future__ import annotations

from typing import Any, Dict

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.services.observability import (
    reset_metrics,
    record_session_created,
    record_index_built,
    record_query,
    record_query_error,
)


@pytest.fixture
def client():
    return TestClient(app)


def _configure_auth(monkeypatch: pytest.MonkeyPatch, admin_email: str = "admin@example.com"):
    monkeypatch.setattr(settings, "GOOGLE_AUTH_ENABLED", True)
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setattr(settings, "SESSION_SECRET", "super-secret")
    monkeypatch.setattr(settings, "ADMIN_GOOGLE_EMAIL", admin_email)


def _mock_google_verify(monkeypatch: pytest.MonkeyPatch):
    def fake_verify(token: str, _req: Any, audience: str) -> Dict[str, Any]:
        assert audience == "client-id"
        email = "admin@example.com" if token == "admin-token" else "user@example.com"
        return {"aud": audience, "email": email, "sub": f"{token}-sub"}

    monkeypatch.setattr("app.routers.auth.id_token.verify_oauth2_token", fake_verify)


def test_metrics_summary_requires_admin(monkeypatch: pytest.MonkeyPatch, client: TestClient):
    _configure_auth(monkeypatch)
    _mock_google_verify(monkeypatch)

    # Without authentication
    resp = client.get("/api/metrics/summary")
    assert resp.status_code == 401

    # Authenticated non-admin
    login = client.post("/api/auth/google", json={"id_token": "user-token"})
    assert login.status_code == 200
    assert login.json()["is_admin"] is False
    resp = client.get("/api/metrics/summary")
    assert resp.status_code == 403


def test_metrics_summary_returns_counts(monkeypatch: pytest.MonkeyPatch, client: TestClient):
    _configure_auth(monkeypatch)
    _mock_google_verify(monkeypatch)

    reset_metrics()
    record_session_created()
    record_index_built()
    record_query("grounded", "high")
    record_query("blended", None)
    record_query_error()

    admin_login = client.post("/api/auth/google", json={"id_token": "admin-token"})
    assert admin_login.status_code == 200
    assert admin_login.json()["is_admin"] is True

    resp = client.get("/api/metrics/summary")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["total_sessions"] == 1
    assert payload["total_indices"] == 1
    assert payload["total_queries"] == 2
    assert payload["queries_by_mode"]["grounded"] == 1
    assert payload["queries_by_mode"]["blended"] == 1
    assert payload["queries_by_confidence"]["high"] == 1
    assert payload["queries_by_confidence"]["medium"] == 0
    assert payload["queries_by_confidence"]["low"] == 0
    assert payload["last_query_ts"] is not None
    assert payload["last_error_ts"] is not None
    assert payload["rerank_strategy_current"]
    assert payload["answer_mode_default"]
    assert "graph_enabled" in payload
    assert "advanced_graph_enabled" in payload
    assert "advanced_llm_enabled" in payload
    assert "llm_rerank_enabled" in payload
    assert "advanced_default_k" in payload
    assert "advanced_default_temperature" in payload


def test_health_details(monkeypatch: pytest.MonkeyPatch, client: TestClient):
    monkeypatch.setattr(settings, "GOOGLE_AUTH_ENABLED", False)
    resp = client.get("/api/health/details")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["status"] == "ok"
    assert "rerank_strategy_effective" in payload
    assert "rerank_strategy_configured" in payload
    assert "ce_available" in payload
    assert "llm_available" in payload
    assert "answer_mode_default" in payload
    assert "graph_enabled" in payload
    assert "advanced_graph_enabled" in payload
    assert "advanced_llm_enabled" in payload
    assert "llm_rerank_enabled" in payload
    assert "advanced_default_k" in payload
    assert "advanced_default_temperature" in payload
    assert "advanced_max_subqueries" in payload
