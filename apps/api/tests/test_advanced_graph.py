from __future__ import annotations

import io

from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.services import session_auth
from app.services import advanced as advanced_service
from app.services import runtime_config as runtime_config_service
from app.services.runtime_config import FeatureFlags, GraphRagConfig, RuntimeConfig


client = TestClient(app)


def _disable_auth(monkeypatch) -> None:
    monkeypatch.setattr(session_auth, "maybe_require_auth", lambda user: None)


def _upload_and_index(monkeypatch) -> str:
    monkeypatch.setattr(settings, "EMBEDDINGS_PROVIDER", "fake")
    files = {"files": ("policy.txt", b"Our PTO Policy references Remote Policy and Security Guide.", "text/plain")}
    upload = client.post("/api/upload", files=files)
    assert upload.status_code == 200
    session_id = upload.json()["session_id"]
    index = client.post("/api/index", json={"session_id": session_id, "chunk_size": 200, "overlap": 40})
    assert index.status_code == 200
    return session_id


def _set_runtime_config(monkeypatch, **overrides) -> RuntimeConfig:
    feature_defaults = {
        "google_auth_enabled": overrides.pop("google_auth_enabled", False),
        "graph_enabled": overrides.pop("graph_enabled", True),
        "llm_rerank_enabled": overrides.pop("llm_rerank_enabled", False),
        "fact_check_llm_enabled": overrides.pop("fact_check_llm_enabled", False),
        "fact_check_strict": overrides.pop("fact_check_strict", False),
    }
    graph_defaults = {
        "max_graph_hops": overrides.pop("max_graph_hops", 2),
        "advanced_max_subqueries": overrides.pop("advanced_max_subqueries", 3),
        "advanced_default_k": overrides.pop("advanced_default_k", 6),
        "advanced_default_temperature": overrides.pop("advanced_default_temperature", 0.2),
    }
    features = FeatureFlags(**feature_defaults)
    graph = GraphRagConfig(**graph_defaults)
    cfg = RuntimeConfig(environment="test", features=features, graph_rag=graph)
    monkeypatch.setattr(runtime_config_service, "_test_override", cfg, raising=False)
    monkeypatch.setattr(runtime_config_service, "_runtime_config_cache", cfg, raising=False)
    return cfg


def test_advanced_query_disabled(monkeypatch):
    _disable_auth(monkeypatch)
    _set_runtime_config(monkeypatch, graph_enabled=False)
    resp = client.post("/api/query/advanced", json={"session_id": "x", "query": "test"})
    assert resp.status_code == 400
    assert "disabled" in resp.json()["detail"].lower()


def test_advanced_query_flow(monkeypatch):
    _disable_auth(monkeypatch)
    _set_runtime_config(monkeypatch, graph_enabled=True, max_graph_hops=2, fact_check_strict=True)
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
    assert data["trace"] is not None
    assert data["trace"]["request_id"]
    assert data["trace"]["planner_steps"]
    assert data["trace"]["retrieval_hits"]
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
    _set_runtime_config(monkeypatch, graph_enabled=True, max_graph_hops=1, fact_check_llm_enabled=False)
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


def test_advanced_query_env_fallback(monkeypatch):
    _disable_auth(monkeypatch)
    runtime_config_service.clear_runtime_config_override()
    monkeypatch.setenv("FIRESTORE_CONFIG_ENABLED", "false")
    monkeypatch.setenv("GRAPH_ENABLED", "true")
    monkeypatch.setenv("MAX_GRAPH_HOPS", "2")
    runtime_config_service.reload_runtime_config()
    session_id = _upload_and_index(monkeypatch)

    resp = client.post(
        "/api/query/advanced",
        json={"session_id": session_id, "query": "Does the PTO policy mention security?"},
    )
    assert resp.status_code == 200
    assert resp.json()["session_id"] == session_id

    monkeypatch.delenv("GRAPH_ENABLED", raising=False)
    monkeypatch.delenv("MAX_GRAPH_HOPS", raising=False)
    monkeypatch.delenv("FIRESTORE_CONFIG_ENABLED", raising=False)
    runtime_config_service.reload_runtime_config()


def test_advanced_query_firestore_override(monkeypatch):
    _disable_auth(monkeypatch)
    runtime_config_service.clear_runtime_config_override()
    monkeypatch.setenv("FIRESTORE_CONFIG_ENABLED", "true")
    monkeypatch.setenv("CONFIG_ENV", "unit")
    monkeypatch.setenv("GRAPH_ENABLED", "false")

    def fake_fetch(collection, env_name):
        assert env_name == "unit"
        return {
            "environment": env_name,
            "features": {
                "graph_enabled": True,
                "llm_rerank_enabled": False,
                "fact_check_llm_enabled": False,
                "fact_check_strict": False,
            },
            "graph_rag": {"max_graph_hops": 2},
        }

    monkeypatch.setattr(runtime_config_service, "_fetch_firestore_document", fake_fetch)
    runtime_config_service.reload_runtime_config()
    session_id = _upload_and_index(monkeypatch)
    resp = client.post(
        "/api/query/advanced",
        json={"session_id": session_id, "query": "Does Firestore config allow graph mode?"},
    )
    assert resp.status_code == 200
    assert resp.json()["session_id"] == session_id

    monkeypatch.delenv("FIRESTORE_CONFIG_ENABLED", raising=False)
    monkeypatch.delenv("CONFIG_ENV", raising=False)
    monkeypatch.delenv("GRAPH_ENABLED", raising=False)
    runtime_config_service.reload_runtime_config()


def test_advanced_query_llm_pipeline(monkeypatch):
    _disable_auth(monkeypatch)
    _set_runtime_config(
        monkeypatch,
        graph_enabled=True,
        max_graph_hops=1,
        llm_rerank_enabled=True,
        fact_check_llm_enabled=True,
    )
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
    _set_runtime_config(monkeypatch, graph_enabled=True, max_graph_hops=1, llm_rerank_enabled=True)
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
    assert payload["trace"]


def test_advanced_trace_warns_when_no_evidence(monkeypatch):
    _disable_auth(monkeypatch)
    _set_runtime_config(monkeypatch, graph_enabled=True, max_graph_hops=1)
    session_id = _upload_and_index(monkeypatch)

    def fake_prepare(session_id, query, *, max_hops, answer_top_k):
        diagnostics = advanced_service.SubQueryDiagnostics([], 0, 0, 0, 0, 0.0)
        return [], [], diagnostics

    monkeypatch.setattr(advanced_service, "_prepare_retrieval", fake_prepare)
    resp = client.post(
        "/api/query/advanced",
        json={
            "session_id": session_id,
            "query": "Trace warnings test",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    trace = data["trace"]
    assert trace is not None
    assert trace["retrieval_hits"] == []
    assert trace["warnings"]
