from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Sequence, Tuple

import numpy as np
from rank_bm25 import BM25Okapi


TOKEN_PATTERN = re.compile(r"\w+")


def _tokenize(text: str) -> List[str]:
    return TOKEN_PATTERN.findall(text.lower())


def _l2_normalize(v: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(v, axis=-1, keepdims=True) + 1e-8
    return v / norm


def search_dense(index, q_emb: np.ndarray, top_k: int) -> Tuple[np.ndarray, np.ndarray]:
    if top_k <= 0:
        top_k = 1
    q = _l2_normalize(q_emb.astype("float32"))
    scores, idxs = index.search(q, top_k)
    return scores, idxs


def build_bm25(doc_texts: Sequence[str]) -> Tuple[BM25Okapi, List[List[str]]]:
    tokenized = [_tokenize(text) for text in doc_texts]
    return BM25Okapi(tokenized), tokenized


def search_bm25(bm25: BM25Okapi | None, tokenized: Sequence[Sequence[str]] | None, query: str, top_k: int) -> Tuple[np.ndarray, np.ndarray]:
    if bm25 is None or not tokenized:
        return np.zeros(0, dtype=np.float32), np.asarray([], dtype=int)
    if top_k <= 0:
        top_k = 1
    q_tokens = _tokenize(query)
    scores = np.asarray(bm25.get_scores(q_tokens), dtype=np.float32)
    if scores.size == 0:
        return scores, np.asarray([], dtype=int)
    order = np.argsort(scores)[::-1][:top_k]
    return scores, order


def rrf_fuse(dense_order: Sequence[int], lexical_order: Sequence[int], *, k_rrf: int, top_k: int) -> List[Tuple[int, float]]:
    ranks: Dict[int, float] = {}
    for r, idx in enumerate(dense_order):
        if idx < 0:
            continue
        ranks[idx] = ranks.get(idx, 0.0) + 1.0 / (k_rrf + r + 1.0)
    for r, idx in enumerate(lexical_order):
        if idx < 0:
            continue
        ranks[idx] = ranks.get(idx, 0.0) + 1.0 / (k_rrf + r + 1.0)
    fused = sorted(ranks.items(), key=lambda item: item[1], reverse=True)
    return fused[:top_k]


def mmr_select(query_vec: np.ndarray, embeddings: np.ndarray | None, candidate_idxs: Sequence[int], *, lam: float, k: int) -> List[int]:
    if not candidate_idxs:
        return []
    if embeddings is None:
        return list(candidate_idxs[:k])
    lam = float(lam)
    if k <= 0:
        return []
    selected: List[int] = []
    remaining = [idx for idx in candidate_idxs if 0 <= idx < embeddings.shape[0]]
    if not remaining:
        return []
    cand = embeddings.astype("float32")
    q = query_vec.reshape(-1).astype("float32")
    sims = cand @ q
    while remaining and len(selected) < k:
        best_idx = None
        best_score = -math.inf
        for idx in remaining:
            relevance = float(sims[idx])
            diversity = 0.0
            if selected:
                diversity = max(float(cand[idx] @ cand[j]) for j in selected)
            score = lam * relevance - (1.0 - lam) * diversity
            if score > best_score:
                best_score = score
                best_idx = idx
        if best_idx is None:
            break
        selected.append(best_idx)
        remaining.remove(best_idx)
    return selected


@dataclass
class RetrievalHit:
    idx: int
    dense_score: float
    lexical_score: float
    fused_score: float
    rerank_score: float | None = None


def hybrid_retrieve(
    session_index,
    query_vec: np.ndarray,
    query_text: str,
    *,
    strategy: str,
    dense_k: int,
    lexical_k: int,
    fusion_rrf_k: int,
    answer_top_k: int,
    mmr_lambda: float,
    use_mmr: bool,
) -> Tuple[List[RetrievalHit], Dict[str, Any]]:
    if dense_k <= 0:
        dense_k = answer_top_k
    dense_scores, dense_idxs = search_dense(session_index.faiss_index, query_vec.reshape(1, -1), dense_k)
    dense_order = [int(idx) for idx in dense_idxs[0] if idx >= 0]
    dense_map = {idx: float(dense_scores[0][pos]) for pos, idx in enumerate(dense_order) if idx >= 0 and pos < dense_scores.shape[1]}

    lexical_scores = np.zeros(session_index.embeddings.shape[0], dtype=np.float32) if session_index.embeddings is not None else np.zeros(0, dtype=np.float32)
    lexical_order: List[int] = []
    lexical_map: Dict[int, float] = {}
    if strategy != "dense":
        lexical_scores, lex_idxs = search_bm25(session_index.bm25, session_index.bm25_tokens, query_text, lexical_k)
        lexical_order = [int(idx) for idx in lex_idxs if idx >= 0]
        lexical_map = {idx: float(lexical_scores[idx]) for idx in lexical_order if idx < lexical_scores.shape[0]}

    fusion_top_k = max(answer_top_k, len(dense_order), len(lexical_order), 1)
    fused = rrf_fuse(dense_order, lexical_order, k_rrf=fusion_rrf_k, top_k=fusion_top_k)
    fused_order = [idx for idx, _ in fused]
    fused_map = {idx: score for idx, score in fused}

    candidate_order = fused_order or dense_order
    if use_mmr and candidate_order:
        selected = mmr_select(query_vec, session_index.embeddings, candidate_order, lam=mmr_lambda, k=answer_top_k)
    else:
        selected = candidate_order[:answer_top_k]

    hits: List[RetrievalHit] = []
    for idx in selected:
        if idx < 0 or idx >= len(session_index.chunk_map):
            continue
        hits.append(
            RetrievalHit(
                idx=idx,
                dense_score=dense_map.get(idx, 0.0),
                lexical_score=lexical_map.get(idx, 0.0),
                fused_score=fused_map.get(idx, 0.0),
            )
        )

    metadata: Dict[str, Any] = {
        "dense_order": dense_order,
        "lexical_order": lexical_order,
        "fused_order": fused_order,
        "dense_scores": dense_map,
        "lexical_scores": lexical_map,
        "fused_scores": fused_map,
        "selected": selected,
        "params": {
            "strategy": strategy,
            "dense_k": dense_k,
            "lexical_k": lexical_k,
            "fusion_rrf_k": fusion_rrf_k,
            "answer_top_k": answer_top_k,
            "mmr_lambda": mmr_lambda,
            "use_mmr": use_mmr,
        },
    }
    return hits, metadata
