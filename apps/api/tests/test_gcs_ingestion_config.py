from __future__ import annotations

import types

import pytest

from app import config
from app.services import gcs_ingestion
from app.services.gcs_ingestion import GcsIngestionConfig


def test_settings_requires_bucket_when_enabled():
    with pytest.raises(ValueError):
        config.Settings(
            EMBEDDINGS_PROVIDER="fake",
            SESSION_SECRET="test-secret",
            GCS_INGESTION_ENABLED=True,
        )


def test_settings_normalizes_prefix_and_validates_ttl():
    with pytest.raises(ValueError):
        config.Settings(
            EMBEDDINGS_PROVIDER="fake",
            SESSION_SECRET="test-secret",
            GCS_INGESTION_ENABLED=True,
            GCS_INGESTION_BUCKET="bucket",
            GCS_INGESTION_TTL_DAYS=0,
        )

    settings = config.Settings(
        EMBEDDINGS_PROVIDER="fake",
        SESSION_SECRET="test-secret",
        GCS_INGESTION_ENABLED=True,
        GCS_INGESTION_BUCKET="bucket",
        GCS_INGESTION_PREFIX="/custom",
    )
    assert settings.GCS_INGESTION_PREFIX == "custom/"


def test_get_config_disabled(monkeypatch):
    monkeypatch.setattr(config.settings, "GCS_INGESTION_ENABLED", False, raising=False)
    monkeypatch.setattr(config.settings, "GCS_INGESTION_BUCKET", None, raising=False)
    monkeypatch.setattr(config.settings, "GCS_INGESTION_PREFIX", "uploads/", raising=False)
    monkeypatch.setattr(config.settings, "GCS_INGESTION_TTL_DAYS", 5, raising=False)

    cfg = gcs_ingestion.get_gcs_ingestion_config()
    assert cfg == GcsIngestionConfig(enabled=False, bucket=None, prefix="uploads/", ttl_days=5)


def test_build_blob_path_sanitizes(monkeypatch):
    monkeypatch.setattr(
        gcs_ingestion,
        "get_gcs_ingestion_config",
        lambda: GcsIngestionConfig(enabled=False, bucket=None, prefix="uploads/", ttl_days=1),
    )
    path = gcs_ingestion.build_blob_path(" session id ", "report final?.pdf")
    assert path.startswith("uploads/session-id/")
    assert path.endswith("report-final-.pdf")


def test_upload_requires_enabled(monkeypatch):
    monkeypatch.setattr(
        gcs_ingestion,
        "get_gcs_ingestion_config",
        lambda: GcsIngestionConfig(enabled=False, bucket=None, prefix="uploads/", ttl_days=1),
    )
    with pytest.raises(RuntimeError):
        gcs_ingestion.upload_file_for_session("s", "f.txt", b"data")


def test_upload_uses_storage_client(monkeypatch):
    config_obj = GcsIngestionConfig(enabled=True, bucket="bucket", prefix="uploads/", ttl_days=1)
    monkeypatch.setattr(gcs_ingestion, "get_gcs_ingestion_config", lambda: config_obj)

    uploaded = {}

    class DummyBlob:
        def __init__(self, name):
            self.name = name

        def upload_from_string(self, data):
            uploaded["data"] = data

    class DummyBucket:
        def __init__(self, name):
            self.name = name

        def blob(self, path):
            uploaded["bucket"] = self.name
            uploaded["path"] = path
            return DummyBlob(path)

    class DummyClient:
        def bucket(self, name):
            return DummyBucket(name)

    monkeypatch.setattr(gcs_ingestion, "storage", types.SimpleNamespace(Client=lambda: DummyClient()))
    result = gcs_ingestion.upload_file_for_session("sess", "file.txt", b"hello")
    assert result.startswith("uploads/")
    assert uploaded["bucket"] == "bucket"
    assert uploaded["path"] == result
    assert uploaded["data"] == b"hello"
