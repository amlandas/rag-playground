from __future__ import annotations

import re
from typing import Optional

from google.cloud import storage
from pydantic import BaseModel

from ..config import settings

_SAFE_CHARS = re.compile(r"[^A-Za-z0-9._-]+")


class GcsIngestionConfig(BaseModel):
    enabled: bool
    bucket: Optional[str]
    prefix: str
    ttl_days: int


def get_gcs_ingestion_config() -> GcsIngestionConfig:
    return GcsIngestionConfig(
        enabled=settings.GCS_INGESTION_ENABLED,
        bucket=settings.GCS_INGESTION_BUCKET,
        prefix=settings.GCS_INGESTION_PREFIX,
        ttl_days=settings.GCS_INGESTION_TTL_DAYS,
    )


def _sanitize_slug(value: str, fallback: str) -> str:
    cleaned = value.strip()
    cleaned = cleaned.replace(" ", "-")
    cleaned = _SAFE_CHARS.sub("-", cleaned)
    cleaned = cleaned.strip("-")
    return cleaned or fallback


def build_blob_path(session_id: str, filename: str) -> str:
    config = get_gcs_ingestion_config()
    session_slug = _sanitize_slug(session_id, "session")
    name_slug = _sanitize_slug(filename or "file", "file")
    return f"{config.prefix}{session_slug}/{name_slug}"


def upload_file_for_session(session_id: str, filename: str, data: bytes) -> str:
    config = get_gcs_ingestion_config()
    if not config.enabled:
        raise RuntimeError("GCS ingestion is disabled.")
    if not config.bucket:
        raise RuntimeError("GCS ingestion bucket is not configured.")
    blob_path = build_blob_path(session_id, filename)
    client = storage.Client()
    bucket = client.bucket(config.bucket)
    blob = bucket.blob(blob_path)
    blob.upload_from_string(data)
    return blob_path
