from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.services import gcs_ingestion
from app.services.gcs_ingestion import GcsIngestionConfig
from app.services.session import ensure_session

client = TestClient(app)


def test_upload_in_memory_flow(monkeypatch):
    monkeypatch.setattr(settings, "EMBEDDINGS_PROVIDER", "fake", raising=False)
    monkeypatch.setattr(settings, "GCS_INGESTION_ENABLED", False, raising=False)
    files = {"files": ("note.txt", b"hello world", "text/plain")}
    upload = client.post("/api/upload", files=files)
    assert upload.status_code == 200
    session_id = upload.json()["session_id"]
    sess = ensure_session(session_id)
    doc = next(iter(sess["docs"].values()))
    assert doc["storage"] == "memory"
    assert doc["text"]


def test_upload_and_index_with_gcs(monkeypatch):
    monkeypatch.setattr(settings, "EMBEDDINGS_PROVIDER", "fake", raising=False)
    monkeypatch.setattr(settings, "GCS_INGESTION_ENABLED", True, raising=False)
    monkeypatch.setattr(settings, "GCS_INGESTION_BUCKET", "bucket", raising=False)
    monkeypatch.setattr(settings, "GCS_INGESTION_PREFIX", "uploads/", raising=False)
    monkeypatch.setattr(settings, "GCS_INGESTION_TTL_DAYS", 1, raising=False)

    captured = {}

    def fake_upload(session_id, doc_id, filename, data):
        captured["session_id"] = session_id
        captured["doc_id"] = doc_id
        captured["filename"] = filename
        captured["data"] = data
        return f"uploads/{session_id}/{doc_id}/{filename}"

    monkeypatch.setattr(gcs_ingestion, "upload_file_for_session", fake_upload)

    downloaded = {}

    def fake_download(path):
        downloaded["path"] = path
        return b"Mock contents for indexing."

    monkeypatch.setattr(gcs_ingestion, "download_blob_bytes", fake_download)

    files = {"files": ("note.txt", b"hello", "text/plain")}
    upload = client.post("/api/upload", files=files)
    assert upload.status_code == 200
    session_id = upload.json()["session_id"]
    assert captured["session_id"] == session_id
    sess = ensure_session(session_id)
    doc = next(iter(sess["docs"].values()))
    assert doc["storage"] == "gcs"
    assert doc["object_path"] == f"uploads/{session_id}/{captured['doc_id']}/{captured['filename']}"

    index = client.post("/api/index", json={"session_id": session_id, "chunk_size": 200, "overlap": 40})
    assert index.status_code == 200
    assert downloaded["path"] == doc["object_path"]


def test_upload_errors_when_gcs_misconfigured(monkeypatch):
    files = {"files": ("note.txt", b"hello", "text/plain")}

    monkeypatch.setattr(
        gcs_ingestion,
        "get_gcs_ingestion_config",
        lambda: GcsIngestionConfig(enabled=True, bucket=None, prefix="uploads/", ttl_days=1),
    )
    resp = client.post("/api/upload", files=files)
    assert resp.status_code == 500
    assert "bucket" in resp.json()["detail"].lower()
