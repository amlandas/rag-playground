from __future__ import annotations

from typing import List, Tuple


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 120) -> List[Tuple[int, int, str]]:
    if chunk_size <= 0:
        return []

    chunks: List[Tuple[int, int, str]] = []
    n = len(text)
    step = max(1, chunk_size - overlap)
    start = 0

    while start < n:
        end = min(n, start + chunk_size)
        chunks.append((start, end, text[start:end]))
        if end >= n:
            break
        start += step

    return chunks
