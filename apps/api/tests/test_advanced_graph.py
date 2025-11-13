from __future__ import annotations

import io

from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.services import session_auth
from app.services import advanced as advanced_service


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
    assert "disabled" in resp.json()["detail"].lower()


def test_advanced_query_flow(monkeypatch):
    _disable_auth(monkeypatch)
    monkeypatch.setattr(settings, "GRAPH_ENABLED", True)
    monkeypatch.setattr(settings, "MAX_GRAPH_HOPS", 2)
    session_id = _upload_and_index(monkeypatch)

    resp = client.post(
        "/api/query/advanced",
        json={
            "session_id": session_id,
            "query": "What is the PTO policy referencing remote requirements?",
            "verification_mode": "ragv",
            "k": 3,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == session_id
    assert data["answer"]
    assert data["verification"]
    assert data["verification"]["mode"] == "ragv"
    assert data["subqueries"]
    first = data["subqueries"][0]
    assert "retrieved_meta" in first
    assert "graph_paths" in first
    assert first["metrics"]["graph_candidates"] >= 0


def test_advanced_query_llm_verification_flag(monkeypatch):
    _disable_auth(monkeypatch)
    monkeypatch.setattr(settings, "GRAPH_ENABLED", True)
    monkeypatch.setattr(settings, "MAX_GRAPH_HOPS", 1)
    monkeypatch.setattr(settings, "FACT_CHECK_LLM_ENABLED", False)
    session_id = _upload_and_index(monkeypatch)

    resp = client.post(
        "/api/query/advanced",
        json={
            "session_id": session_id,
            "query": "Does the remote policy mention security?",
            "verification_mode": "llm",
        },
    )
    assert resp.status_code == 400
    assert "llm" in resp.json()["detail"].lower()


def test_advanced_query_respects_env_override(monkeypatch):
    _disable_auth(monkeypatch)
    monkeypatch.setattr(settings, "GRAPH_ENABLED", False)
    monkeypatch.setattr(settings, "MAX_GRAPH_HOPS", 2)
    monkeypatch.setenv("GRAPH_ENABLED", "true")
    session_id = _upload_and_index(monkeypatch)

    resp = client.post(
        "/api/query/advanced",
        json={
            "session_id": session_id,
            "query": "Does the PTO policy mention security?",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == session_id
    assert data["subqueries"]


def test_advanced_query_llm_pipeline(monkeypatch):
    _disable_auth(monkeypatch)
    monkeypatch.setattr(settings, "GRAPH_ENABLED", True)
    monkeypatch.setattr(settings, "MAX_GRAPH_HOPS", 1)
    session_id = _upload_and_index(monkeypatch)

    call_tracker = {"sub": 0, "final": 0}
    monkeypatch.setattr(advanced_service, "_llm_capable", lambda: True)

    def fake_sub_llm(sub_query, snippets, *, model, temperature):
        call_tracker["sub"] += 1
        return f"LLM summary for {sub_query}"

    def fake_final_llm(question, subqueries, *, model, temperature):
        call_tracker["final"] += 1
        return (
            "Final LLM answer",
            [
                {"id": "S1", "doc_id": "doc-id", "chunk_index": 0, "start": 0, "end": 10},
            ],
        )

    monkeypatch.setattr(advanced_service, "_summarize_subquery_llm", fake_sub_llm)
    monkeypatch.setattr(advanced_service, "_synthesize_answer_llm", fake_final_llm)

    resp = client.post(
        "/api/query/advanced",
        json={
            "session_id": session_id,
            "query": "Summarize the PTO policy links",
            "model": "gpt-test",
        },
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["answer"] == "Final LLM answer"
    assert call_tracker["final"] == 1
    assert call_tracker["sub"] == len(payload["subqueries"])
    assert payload["planner"]["model"] == "gpt-test"
    assert all(sub["answer"].startswith("LLM summary") for sub in payload["subqueries"])


def test_advanced_query_no_verification_still_llm(monkeypatch):
    _disable_auth(monkeypatch)
    monkeypatch.setattr(settings, "GRAPH_ENABLED", True)
    monkeypatch.setattr(settings, "MAX_GRAPH_HOPS", 1)
    session_id = _upload_and_index(monkeypatch)
    monkeypatch.setattr(advanced_service, "_llm_capable", lambda: True)
    monkeypatch.setattr(advanced_service, "_summarize_subquery_llm", lambda *args, **kwargs: "LLM sub-answer")
    monkeypatch.setattr(
        advanced_service,
        "_synthesize_answer_llm",
        lambda *args, **kwargs: ("Synthesis output", [{"id": "S1", "doc_id": "doc-id", "chunk_index": 0, "start": 0, "end": 10}]),
    )

    resp = client.post(
        "/api/query/advanced",
        json={
            "session_id": session_id,
            "query": "Show me the remote policy status",
            "verification_mode": "none",
        },
    )
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["answer"] == "Synthesis output"
    assert payload["verification"] is None
