from __future__ import annotations

from typing import Iterable, List, Tuple

from openai import OpenAI

from ..config import settings

SYSTEM_PROMPT = (
    "You are a retrieval-augmented assistant. "
    "Use only the provided context snippets to answer. "
    "If the context is insufficient, reply: "
    "'Insufficient context in the provided documents to answer confidently.' "
    "Always cite sources inline like [1], [2]."
)


def get_client() -> OpenAI:
    if settings.OPENAI_BASE_URL:
        return OpenAI(api_key=settings.OPENAI_API_KEY, base_url=settings.OPENAI_BASE_URL)
    return OpenAI(api_key=settings.OPENAI_API_KEY)


def format_context(snippets: List[Tuple[int, str]]) -> str:
    lines = []
    for rank, text in snippets:
        lines.append(f"[{rank}] {text}")
    return "\n\n".join(lines)


def stream_answer(prompt: str, snippets: List[Tuple[int, str]], model: str, temperature: float) -> Iterable[str]:
    client = get_client()
    context = format_context(snippets)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {prompt}"},
    ]

    with client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        stream=True,
    ) as stream:
        for event in stream:
            choice = event.choices[0]
            delta = getattr(choice, "delta", None)
            if delta and delta.content:
                yield delta.content
