from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Sequence

from ..config import settings

CRLF_RE = re.compile(r"\r\n?")
EXTRA_NEWLINES_RE = re.compile(r"\n{3,}")
MODEL_PRIOR_RE = re.compile(r"\*\(model prior\)\*", re.IGNORECASE)


@dataclass
class AnswerSource:
    id: int
    text: str
    meta: Dict[str, Any]


def prepare_sources(
    hits: Sequence[Any],
    chunk_map: Sequence[Any],
    limit: int,
) -> tuple[List[AnswerSource], Dict[int, int]]:
    sources: List[AnswerSource] = []
    mapping: Dict[int, int] = {}
    next_id = 1
    for hit in hits:
        if next_id > limit:
            break
        chunk_idx = hit.idx
        if chunk_idx < 0 or chunk_idx >= len(chunk_map):
            continue
        doc_id, start, end, text = chunk_map[chunk_idx]
        sources.append(
            AnswerSource(
                id=next_id,
                text=text,
                meta={
                    "doc_id": doc_id,
                    "span": [start, end],
                    "chunk_index": chunk_idx,
                },
            )
        )
        mapping[chunk_idx] = next_id
        next_id += 1
    return sources, mapping


AnswerMode = Literal["grounded", "blended"]


def build_messages(query: str, sources: List[AnswerSource], mode: AnswerMode) -> List[Dict[str, str]]:
    tone = settings.ANSWER_TONE
    markdown_flag = settings.ANSWER_MD
    format_clause = (
        "Write Markdown paragraphs separated by blank lines. When you enumerate items, insert a blank line before the list, use '- ' bullets with one item per line, and leave a blank line after the final bullet. Use **bold** only when it genuinely helps (for example, the first mention of a key product); do not wrap every token in bold."
        if markdown_flag
        else "Write in clear sentences with natural spacing."
    )

    base_instructions = [
        "You are a helpful analyst summarizing uploaded documents.",
        "Write in natural, confident prose with varied sentence structure and precise punctuation so the answer reads like a human wrote it.",
        format_clause,
        "Copy product and model names exactly as they appear in the documents; keep prefixes such as 'OptiPlex' or 'Dell Pro' and retain descriptors like 'All-in-One 35W'.",
        "Do not abbreviate, truncate, or otherwise shorten model names.",
        "Every sentence that draws on the documents must end with citations such as [1] or [1][2] placed immediately after the closing punctuation.",
        "Avoid stray or unbalanced '*' characters; prefer plain text for product names unless brief emphasis is helpful.",
        "Never invent or guess citations.",
        "Leave exactly one blank line before the final Sources line, which must read Sources: followed by the unique citation ids used in ascending order with no commas (for example, Sources: [1][2][5]).",
        f"Adopt a {tone} tone.",
    ]
    if not sources:
        base_instructions.append(
            "If no sources are provided, say you cannot answer from the documents before offering any optional world knowledge."
        )

    if mode == "grounded":
        mode_instructions = [
            "Begin with a concise summary paragraph that answers the question. Do not add a heading before this paragraph.",
            "Use bullet lists only when you need to enumerate items, ensuring a blank line before the list and a blank line after the final bullet.",
            "Keep all content grounded in the supplied sources.",
            "If the documents are insufficient, reply exactly \"I don't know from the provided documents.\"",
            "Do not include world knowledge or any 'World notes' section.",
        ]
    else:
        mode_instructions = [
            "Begin with document-grounded paragraphs in the same style as grounded mode (no heading).",
            "When you enumerate items from the documents, follow the same blank-line rules for bullet lists.",
            "After you finish the document-backed discussion, insert a blank line and write World notes on its own line, then provide one or more bullets ending with '(model prior)'.",
            "Sentences in 'World notes' must not use [n] citations and instead end with ' (model prior)'.",
            "Never present world knowledge as if it came from the documents.",
        ]

    system_prompt = " ".join(base_instructions + mode_instructions)
    payload = {
        "question": query,
        "sources": [
            {"id": src.id, "text": src.text, "meta": src.meta}
            for src in sources
        ],
        "instructions": {
            "tone": tone,
            "markdown": settings.ANSWER_MD,
            "mode": mode,
            "has_sources": bool(sources),
        },
    }
    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": json.dumps(payload, ensure_ascii=False),
        },
    ]
    return messages


def citation_mapping(sources: List[AnswerSource]) -> List[Dict[str, Any]]:
    mapping = []
    for src in sources:
        entry = {"id": src.id, "meta": src.meta}
        mapping.append(entry)
    return mapping


def postprocess_chunk(chunk: str) -> str:
    try:
        if not chunk:
            return chunk
        text = CRLF_RE.sub("\n", chunk)
        text = EXTRA_NEWLINES_RE.sub("\n\n", text)
        text = MODEL_PRIOR_RE.sub("(model prior)", text)
        return text
    except Exception:
        return chunk  # fail-safe
