from __future__ import annotations

import numpy as np
from openai import OpenAI

from ..config import settings


def get_openai_client() -> OpenAI:
    if settings.OPENAI_BASE_URL:
        return OpenAI(api_key=settings.OPENAI_API_KEY, base_url=settings.OPENAI_BASE_URL)
    return OpenAI(api_key=settings.OPENAI_API_KEY)


def embed_texts(texts: list[str], model: str = "text-embedding-3-large") -> np.ndarray:
    if not texts:
        return np.empty((0, 0), dtype=np.float32)

    client = get_openai_client()
    response = client.embeddings.create(model=model, input=texts)
    vectors = [np.array(item.embedding, dtype=np.float32) for item in response.data]
    return np.vstack(vectors)
