from __future__ import annotations

from typing import Any, Dict

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.services import runtime_config as runtime_config_service
from app.services.runtime_config import FeatureFlags, GraphRagConfig, RuntimeConfig


@pytest.fixture
def client():
    return TestClient(app)


def _override_auth_runtime(monkeypatch: pytest.MonkeyPatch, enabled: bool) -> None:
    features = FeatureFlags(
        google_auth_enabled=enabled,
        graph_enabled=True,
        llm_rerank_enabled=False,
        fact_check_llm_enabled=False,
        fact_check_strict=False,
    )
    graph = GraphRagConfig()
    cfg = RuntimeConfig(environment="test", features=features, graph_rag=graph)
    monkeypatch.setattr(runtime_config_service, "_test_override", cfg, raising=False)
    monkeypatch.setattr(runtime_config_service, "_runtime_config_cache", cfg, raising=False)


def test_auth_disabled_rejects_login(monkeypatch: pytest.MonkeyPatch, client: TestClient):
    _override_auth_runtime(monkeypatch, False)
    resp = client.post("/api/auth/google", json={"id_token": "token"})
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Google authentication is disabled"
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json() == {"authenticated": False}


def test_google_auth_flow_requires_cookie(monkeypatch: pytest.MonkeyPatch, client: TestClient):
    _override_auth_runtime(monkeypatch, True)
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "client-id")
    monkeypatch.setattr(settings, "SESSION_SECRET", "super-secret")
    monkeypatch.setattr(settings, "ADMIN_GOOGLE_EMAIL", "admin@example.com")

    def fake_verify(token: str, _req: Any, audience: str) -> Dict[str, Any]:
        assert audience == "client-id"
        email = "admin@example.com" if token == "admin-token" else "user@example.com"
        return {"aud": audience, "email": email, "sub": f"{token}-sub"}

    monkeypatch.setattr("app.routers.auth.id_token.verify_oauth2_token", fake_verify)

    files = {"files": ("sample.txt", b"hello world", "text/plain")}

    resp = client.post("/api/upload", files=files)
    assert resp.status_code == 401

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json() == {"authenticated": False}

    login = client.post("/api/auth/google", json={"id_token": "user-token"})
    assert login.status_code == 200
    assert login.cookies.get("rag_session")
    assert login.json() == {"email": "user@example.com", "is_admin": False}

    upload = client.post("/api/upload", files=files)
    assert upload.status_code == 200
    session_id = upload.json()["session_id"]

    metrics = client.get("/api/metrics")
    assert metrics.status_code == 403

    admin_login = client.post("/api/auth/google", json={"id_token": "admin-token"})
    assert admin_login.status_code == 200
    assert admin_login.json() == {"email": "admin@example.com", "is_admin": True}

    metrics_admin = client.get("/api/metrics")
    assert metrics_admin.status_code == 200
    assert "summary" in metrics_admin.json()

    logout = client.post("/api/auth/logout")
    assert logout.status_code == 200
    assert logout.json() == {"ok": True}

    me_after = client.get("/api/auth/me")
    assert me_after.status_code == 200
    assert me_after.json() == {"authenticated": False}

    # sessions remain valid server-side but further API access now requires re-auth
    index = client.post("/api/index", json={"session_id": session_id, "chunk_size": 800, "overlap": 120})
    assert index.status_code == 401
