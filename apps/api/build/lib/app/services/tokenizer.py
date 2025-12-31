from __future__ import annotations

from typing import Optional

import tiktoken


def estimate_tokens(text: str, model: Optional[str] = "gpt-4o-mini") -> int:
    try:
        encoding = tiktoken.encoding_for_model(model) if model else tiktoken.get_encoding("cl100k_base")
    except Exception:
        encoding = tiktoken.get_encoding("cl100k_base")
    return len(encoding.encode(text))
