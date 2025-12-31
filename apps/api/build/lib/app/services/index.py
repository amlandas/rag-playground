from __future__ import annotations

import faiss
import numpy as np


def build_faiss_index(embeddings: np.ndarray, metric: str = "cosine"):
    xb = embeddings.astype(np.float32)
    if xb.size == 0:
        raise ValueError("No embeddings provided")

    if metric == "cosine":
        faiss.normalize_L2(xb)
        index = faiss.IndexFlatIP(xb.shape[1])
    else:
        index = faiss.IndexFlatL2(xb.shape[1])
    index.add(xb)
    return index


def search_index(index, query_vec: np.ndarray, k: int = 4, metric: str = "cosine"):
    q = query_vec.astype(np.float32)
    if metric == "cosine":
        faiss.normalize_L2(q)
    distances, idxs = index.search(q, k)
    return distances, idxs
