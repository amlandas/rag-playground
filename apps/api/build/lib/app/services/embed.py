from __future__ import annotations

import hashlib
import logging
import os

import numpy as np
from openai import OpenAI

from ..config import settings

logger = logging.getLogger(__name__)

FAKE_DIMENSIONS = 384


def get_openai_client() -> OpenAI:
    if settings.OPENAI_BASE_URL:
        return OpenAI(api_key=settings.OPENAI_API_KEY, base_url=settings.OPENAI_BASE_URL)
    return OpenAI(api_key=settings.OPENAI_API_KEY)


def _fake_embedding_vector(text: str, dimensions: int = FAKE_DIMENSIONS) -> np.ndarray:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    seed = int.from_bytes(digest[:8], "big", signed=False)
    rng = np.random.default_rng(seed)
    vector = rng.normal(size=dimensions)
    norm = np.linalg.norm(vector)
    if norm == 0:
        return vector.astype(np.float32)
    return (vector / norm).astype(np.float32)


def embed_texts(texts: list[str], model: str = "text-embedding-3-large") -> np.ndarray:
    provider = os.getenv("EMBEDDINGS_PROVIDER", settings.EMBEDDINGS_PROVIDER).lower()

    if not texts:
        if provider == "fake":
            return np.empty((0, FAKE_DIMENSIONS), dtype=np.float32)
        return np.empty((0, 0), dtype=np.float32)

    if provider == "fake":
        logger.info("Using fake embeddings provider for %d chunks", len(texts))
        vectors = [_fake_embedding_vector(text) for text in texts]
        return np.vstack(vectors)

    client = get_openai_client()
    response = client.embeddings.create(model=model, input=texts)
    vectors = [np.array(item.embedding, dtype=np.float32) for item in response.data]
    return np.vstack(vectors)
