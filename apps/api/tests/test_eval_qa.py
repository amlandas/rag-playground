from __future__ import annotations

"""
Golden QA regression harness.

Each dataset in ``apps/api/tests/data/qa_*.json`` is an array of objects with the
following fields:

    {
        "query": "...",
        "mode": "grounded" | "blended",
        "golden_answer": "string with \\n escapes",
        "expected_contains": ["snippets from the document"],
        "forbidden_contains": ["strings that must not appear"],
        "k": optional retrieval top-k override
    }

The accompanying ``*.txt`` file contains the source text that we index for the
test. Keeping the data in JSON ensures the suite stays deterministic while still
asserting on real answer strings.
"""

import json
import os
import uuid
from pathlib import Path

import numpy as np
import pytest

from app.services.chunk import chunk_text
from app.services.embed import embed_texts
from app.services.index import build_faiss_index
from app.services.compose import build_messages
from app.services.pipeline import prepare_answer_context, resolve_answer_mode
from app.services.retrieve import build_bm25
from app.services.session import SessionIndex, ensure_session, new_session, set_session_index

DATA_DIR = Path(__file__).resolve().parent / "data"
DATASETS = {
    "policy": {
        "doc": DATA_DIR / "policy.txt",
        "qa": DATA_DIR / "qa_policy.json",
    },
    "dell": {
        "doc": DATA_DIR / "dell_excerpt.txt",
        "qa": DATA_DIR / "qa_dell.json",
    },
}

DEFAULT_CHUNK_SIZE = 400
DEFAULT_OVERLAP = 40
DEFAULT_EMBED_MODEL = "text-embedding-3-large"


@pytest.fixture(autouse=True)
def _use_fake_embeddings(monkeypatch):
    monkeypatch.setenv("EMBEDDINGS_PROVIDER", "fake")
    from app.config import settings

    monkeypatch.setattr(settings, "SIMILARITY_FLOOR", 0.0)
    monkeypatch.setattr(settings, "ANSWER_CONFIDENCE_ENABLED", False)


def _build_index_for_document(doc_text: str, *, chunk_size: int = DEFAULT_CHUNK_SIZE, overlap: int = DEFAULT_OVERLAP):
    session_id = new_session()
    sess = ensure_session(session_id)
    doc_id = str(uuid.uuid4())
    sess["docs"][doc_id] = {"name": "document.txt", "text": doc_text}

    chunk_map = []
    all_chunks: list[str] = []
    for start, end, chunk in chunk_text(doc_text, chunk_size=chunk_size, overlap=overlap):
        chunk_map.append((doc_id, start, end, chunk))
        all_chunks.append(chunk)

    if not all_chunks:
        raise AssertionError("Document chunking produced no content")

    embeddings = embed_texts(all_chunks, model=DEFAULT_EMBED_MODEL)
    embeddings = embeddings.astype("float32")
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-8
    normalized = embeddings / norms

    faiss_index = build_faiss_index(normalized, metric="cosine")
    bm25_index, bm25_tokens = build_bm25(all_chunks)

    sess["index"] = {
        "faiss": faiss_index,
        "chunk_map": chunk_map,
        "embed_model": DEFAULT_EMBED_MODEL,
    }
    set_session_index(
        session_id,
        SessionIndex(
            faiss_index=faiss_index,
            chunk_map=chunk_map,
            embeddings=normalized,
            texts=all_chunks,
            bm25=bm25_index,
            bm25_tokens=bm25_tokens,
            embed_model=DEFAULT_EMBED_MODEL,
        ),
    )
    return session_id


@pytest.mark.parametrize("dataset_name", sorted(DATASETS.keys()))
def test_golden_qa(dataset_name):
    dataset = DATASETS[dataset_name]
    doc_text = dataset["doc"].read_text()
    qa_items = json.loads(dataset["qa"].read_text())

    session_id = _build_index_for_document(doc_text)
    sess = ensure_session(session_id)

    for item in qa_items:
        query = item["query"]
        mode_name = item["mode"]
        mode = resolve_answer_mode(mode_name)
        context = prepare_answer_context(
            session_id,
            query,
            item.get("k", 8),
            "cosine",
            mode,
            session=sess,
        )

        retrieved_text = "\n".join(meta["text"] for meta in context["retrieved_meta"])
        golden_answer = item["golden_answer"].replace("\\n", "\n")

        messages = build_messages(query, context["sources"], mode)
        assert messages and messages[0]["role"] == "system"

        for snippet in item.get("expected_contains", []):
            assert snippet in golden_answer, f"expected snippet '{snippet}' missing from golden answer"
            doc_contains = snippet in doc_text
            retrieved_contains = snippet in retrieved_text
            if doc_contains:
                assert retrieved_contains, f"expected snippet '{snippet}' not present in retrieved context"

        for forbidden in item.get("forbidden_contains", []):
            assert forbidden not in golden_answer, f"forbidden snippet '{forbidden}' present in golden answer"

        if mode_name == "grounded":
            assert "World notes" not in golden_answer
        else:
            assert "World notes" in golden_answer
            assert "(model prior)" in golden_answer

        assert "Sources:" in golden_answer
        sources_lines = golden_answer.strip().splitlines()
        assert len(sources_lines) >= 2
        assert sources_lines[-2] == "", "expected blank line before Sources"
