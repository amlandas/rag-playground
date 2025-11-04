import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.compose import AnswerSource


@pytest.fixture()
def client():
    return TestClient(app)


def test_debug_compose_shape(monkeypatch, client):
    monkeypatch.setattr("app.routers.debug.ensure_session", lambda session_id: {"index": {}})

    sample_sources = [
        AnswerSource(id=1, text="Alpha document snippet.", meta={"doc_id": "doc1", "span": [0, 50], "chunk_index": 0}),
        AnswerSource(id=2, text="Bravo details here.", meta={"doc_id": "doc2", "span": [50, 120], "chunk_index": 1}),
    ]
    sample_context = {
        "session": {},
        "chunk_map": [],
        "hits": [],
        "sources": sample_sources,
        "citations": [{"id": src.id, "meta": src.meta} for src in sample_sources],
        "retrieved_meta": [],
        "top_similarity": 0.5,
        "attempt": "primary",
        "floor": 0.18,
        "rerank_strategy": "none",
        "rerank_scores": [],
        "insufficient": False,
        "mode": "grounded",
        "confidence": "medium",
    }

    def fake_prepare(session_id: str, query_text: str, requested_k: int, similarity: str, mode: str, *, session=None):
        assert session_id == "debug-session"
        assert query_text == "What is Alpha?"
        assert mode == "grounded"
        return sample_context

    monkeypatch.setattr("app.routers.debug.prepare_answer_context", fake_prepare)

    response = client.post(
        "/api/debug/compose",
        json={"session_id": "debug-session", "query": "What is Alpha?"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "What is Alpha?"
    assert data["source_ids"] == [1, 2]
    assert len(data["source_snippets"]) == 2
    assert data["citations"] == sample_context["citations"]
    prompt = data["composed_system_prompt"]
    assert "You are a helpful analyst summarizing uploaded documents." in prompt
    assert "Copy product and model names exactly as they appear in the documents" in prompt
    assert "Begin with a concise summary paragraph that answers the question. Do not add a heading before this paragraph." in prompt
    assert "When you enumerate items, insert a blank line before the list, use '- ' bullets with one item per line, and leave a blank line after the final bullet." in prompt
    assert "Avoid stray or unbalanced '*' characters" in prompt
    assert isinstance(data["composed_messages_preview"], list)
    assert not data["insufficient"]
    assert data["mode"] == "grounded"
    assert data["confidence"] == "medium"


def test_debug_compose_blended_prompt(monkeypatch, client):
    monkeypatch.setattr("app.routers.debug.ensure_session", lambda session_id: {"index": {}})
    sample_sources = [
        AnswerSource(id=1, text="Alpha document snippet.", meta={"doc_id": "doc1", "span": [0, 50], "chunk_index": 0}),
    ]
    sample_context = {
        "session": {},
        "chunk_map": [],
        "hits": [],
        "sources": sample_sources,
        "citations": [{"id": 1, "meta": sample_sources[0].meta}],
        "retrieved_meta": [],
        "top_similarity": 0.2,
        "attempt": "primary",
        "floor": 0.18,
        "rerank_strategy": "none",
        "rerank_scores": [],
        "insufficient": False,
        "mode": "blended",
        "confidence": "medium",
    }

    def fake_prepare(session_id: str, query_text: str, requested_k: int, similarity: str, mode: str, *, session=None):
        assert mode == "blended"
        return sample_context

    monkeypatch.setattr("app.routers.debug.prepare_answer_context", fake_prepare)

    response = client.post(
        "/api/debug/compose",
        json={"session_id": "debug-session", "query": "Blend?", "mode": "blended"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "blended"
    prompt = data["composed_system_prompt"]
    assert "Begin with document-grounded paragraphs in the same style as grounded mode (no heading)." in prompt
    assert "Sentences in 'World notes' must not use [n] citations" in prompt
    assert "When you enumerate items, insert a blank line before the list, use '- ' bullets with one item per line, and leave a blank line after the final bullet." in prompt
    assert "Copy product and model names exactly as they appear in the documents" in prompt


def test_debug_retrieve_includes_confidence(monkeypatch, client):
    monkeypatch.setattr("app.routers.debug.ensure_session", lambda session_id: {"index": {}})
    sample_context = {
        "session": {},
        "chunk_map": [],
        "hits": [],
        "sources": [],
        "citations": [],
        "retrieved_meta": [],
        "top_similarity": None,
        "attempt": "primary",
        "floor": 0.18,
        "rerank_strategy": "none",
        "rerank_scores": [],
        "insufficient": True,
        "mode": "grounded",
        "confidence": "low",
    }

    def fake_prepare(session_id: str, query_text: str, requested_k: int, similarity: str, mode: str, *, session=None):
        return sample_context

    monkeypatch.setattr("app.routers.debug.prepare_answer_context", fake_prepare)

    response = client.post(
        "/api/debug/retrieve",
        json={"session_id": "debug-session", "query": "Test?", "k": 4},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["confidence"] == "low"
    assert data["mode"] == "grounded"
