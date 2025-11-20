from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.session import ensure_session, new_session

client = TestClient(app)


@pytest.fixture(autouse=True)
def _use_fake_embeddings(monkeypatch):
    monkeypatch.setenv("EMBEDDINGS_PROVIDER", "fake")


def _create_session_with_text(text: str) -> str:
    session_id = new_session()
    sess = ensure_session(session_id)
    sess["docs"]["doc"] = {"name": "policy.txt", "text": text}
    return session_id


def test_compare_returns_meaningful_snippets(monkeypatch):
    session_id = _create_session_with_text("Our vacation policy provides 15 days of PTO.")

    payload = {
        "session_id": session_id,
        "query": "What is the vacation policy?",
        "profile_a": {"name": "A", "k": 4, "chunk_size": 200, "overlap": 40},
        "profile_b": {"name": "B", "k": 6, "chunk_size": 200, "overlap": 40},
    }

    resp = client.post("/api/compare", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["profile_a"], "Profile A should return snippets"
    assert data["profile_b"], "Profile B should return snippets"
    assert any("vacation policy" in chunk["text"].lower() for chunk in data["profile_a"])
    assert any("vacation policy" in chunk["text"].lower() for chunk in data["profile_b"])
