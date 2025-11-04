from __future__ import annotations

import json
from typing import Iterable, List, Mapping, Sequence

from openai import OpenAI

from ..config import settings
from .compose import postprocess_chunk

HEADING_TITLES = ("## From your documents", "## World notes")


def _normalize_stream_chunk(chunk: str, tail: str) -> tuple[str, str]:
    if not chunk:
        return chunk, tail
    normalized = chunk
    combined = tail + normalized
    new_tail = combined[-200:]
    normalized_output = combined[len(tail):]
    return normalized_output, new_tail


def get_client() -> OpenAI:
    if settings.OPENAI_BASE_URL:
        return OpenAI(api_key=settings.OPENAI_API_KEY, base_url=settings.OPENAI_BASE_URL)
    return OpenAI(api_key=settings.OPENAI_API_KEY)


def stream_chat(
    messages: Sequence[Mapping[str, str]],
    *,
    model: str,
    temperature: float,
    max_tokens: int | None = None,
) -> Iterable[str]:
    client = get_client()
    request_kwargs = {
        "model": model,
        "messages": list(messages),
        "temperature": temperature,
        "stream": True,
    }
    if max_tokens:
        request_kwargs["max_tokens"] = max_tokens

    tail = ""
    with client.chat.completions.create(**request_kwargs) as stream:
        for event in stream:
            choice = event.choices[0]
            delta = getattr(choice, "delta", None)
            if delta and delta.content:
                chunk = postprocess_chunk(delta.content)
                normalized, tail = _normalize_stream_chunk(chunk, tail)
                yield normalized


def stream_answer(
    *,
    prompt: str,
    snippets: Sequence[tuple[int, str]],
    model: str,
    temperature: float,
) -> Iterable[str]:
    messages = [
        {
            "role": "system",
            "content": (
                "Answer using ONLY the provided snippets. Use inline references like [rank] when a snippet "
                "supports a claim. If the snippets lack the answer, reply with 'I don't know from the provided snippets.'"
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "question": prompt,
                    "snippets": [{"rank": rank, "text": text} for rank, text in snippets],
                },
                ensure_ascii=False,
            ),
        },
    ]
    return stream_chat(messages, model=model, temperature=temperature, max_tokens=None)
