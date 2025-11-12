from __future__ import annotations

import io

from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.services import session_auth


client = TestClient(app)


def _disable_auth(monkeypatch) -> None:
    monkeypatch.setattr(settings, "GOOGLE_AUTH_ENABLED", False)
    monkeypatch.setattr(session_auth, "maybe_require_auth", lambda user: None)


def _upload_and_index(monkeypatch) -> str:
    _disable_auth(monkeypatch)
    monkeypatch.setattr(settings, "EMBEDDINGS_PROVIDER", "fake")
    files = {"files": ("policy.txt", b"Our PTO Policy references Remote Policy and Security Guide.", "text/plain")}
    upload = client.post("/api/upload", files=files)
    assert upload.status_code == 200
    session_id = upload.json()["session_id"]
    index = client.post("/api/index", json={"session_id": session_id, "chunk_size": 200, "overlap": 40})
    assert index.status_code == 200
    return session_id


def test_advanced_query_disabled(monkeypatch):
    _disable_auth(monkeypatch)
    monkeypatch.setattr(settings, "GRAPH_ENABLED", False)
    resp = client.post("/api/query/advanced", json={"session_id": "x", "query": "test"})
    assert resp.status_code == 400


def test_advanced_query_flow(monkeypatch):
    _disable_auth(monkeypatch)
    monkeypatch.setattr(settings, "GRAPH_ENABLED", True)
    monkeypatch.setattr(settings, "MAX_GRAPH_HOPS", 2)
    session_id = _upload_and_index(monkeypatch)

    resp = client.post(
        "/api/query/advanced",
        json={"session_id": session_id, "query": "What is the PTO policy referencing remote requirements?"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == session_id
    assert data["subqueries"]
    first = data["subqueries"][0]
    assert "retrieved_meta" in first
    assert "graph_paths" in first
    assert first["metrics"]["graph_candidates"] >= 0
