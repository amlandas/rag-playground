from __future__ import annotations

import logging
import os
from typing import List, Optional, Tuple

from ..config import settings

logger = logging.getLogger(__name__)

print(
    f"[RERANK] effective strategy={settings.RERANK_STRATEGY} "
    f"top_n={getattr(settings, 'RERANK_TOP_N', None)} "
    f"keep={getattr(settings, 'RERANK_KEEP', None)}"
)
print(
    "[RERANK] env candidates: "
    f"RERANK_STRATEGY={os.getenv('RERANK_STRATEGY')} "
    f"RERANK__STRATEGY={os.getenv('RERANK__STRATEGY')} "
    f"RAG_RERANK_STRATEGY={os.getenv('RAG_RERANK_STRATEGY')}"
)

_ce_model = None
_ce_model_id: Optional[str] = None
_ce_error = None


def _load_ce():
    global _ce_model, _ce_model_id, _ce_error
    if _ce_model is None and _ce_error is None:
        try:
            from sentence_transformers import CrossEncoder

            logger.info("[RERANK] initializing CrossEncoder '%s'", settings.CE_MODEL_NAME)
            model = CrossEncoder(settings.CE_MODEL_NAME)
            _ce_model = model
            _ce_model_id = getattr(model, "model_name", settings.CE_MODEL_NAME)
        except Exception as exc:
            _ce_error = exc
            logger.error("[RERANK] CrossEncoder load failed: %r", exc)
            print("[RERANK] CrossEncoder load failed:", repr(exc))
    return _ce_model


def ce_available() -> bool:
    try:
        if _ce_error is not None:
            return False
        return _load_ce() is not None
    except Exception:
        return False


def ce_model_id() -> Optional[str]:
    return _ce_model_id


def rerank_ce(query: str, candidates: List[Tuple[int, str]], top_n: int, keep: int):
    if keep <= 0 or not candidates:
        return None

    model = _load_ce()
    if model is None or _ce_error is not None:
        return None

    trimmed = candidates[: max(top_n, keep)]
    pairs = [(query, text) for _, text in trimmed]
    try:
        scores = model.predict(pairs).tolist()
    except Exception as exc:
        logger.error("[RERANK] CE predict failed: %r", exc)
        print("[RERANK] CE predict failed:", repr(exc))
        return None

    ranked = sorted(
        zip((idx for idx, _ in trimmed), scores),
        key=lambda item: item[1],
        reverse=True,
    )
    return ranked[:keep]


def rerank_llm_openai(
    query: str,
    candidates: List[Tuple[int, str]],
    keep: int,
    *,
    model: Optional[str] = None,
):
    if keep <= 0 or not candidates:
        return None

    try:
        from openai import OpenAI

        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    except Exception as exc:
        logger.error("[RERANK] LLM client init failed: %r", exc)
        print("[RERANK] LLM client init failed:", repr(exc))
        return None

    model_name = model or settings.LLM_RERANK_MODEL
    max_chars = getattr(settings, "LLM_RERANK_MAX_CHARS", 1200)

    def _truncate(text: str) -> str:
        return text[:max_chars]

    items = [{"id": idx, "text": _truncate(text)} for idx, text in candidates]
    prompt_lines = [
        "You are ranking context chunks for a retrieval-augmented generation system.",
        f"Return the IDs of the TOP {keep} most relevant chunks in descending relevance.",
        f"Query: {query}",
        "",
        "Chunks:",
    ]
    prompt_lines.extend(f"- id={item['id']} text={item['text']}" for item in items)
    prompt_lines.append("")
    prompt_lines.append("Return only a comma-separated list of IDs.")
    prompt = "\n".join(prompt_lines)

    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            timeout=20,
        )
        content = (response.choices[0].message.content or "").strip()
    except Exception as exc:
        logger.error("[RERANK] LLM rerank failed: %r", exc)
        print("[RERANK] LLM rerank failed:", repr(exc))
        return None

    ids: List[int] = []
    for token in content.replace("\n", "").split(","):
        token = token.strip()
        if token.isdigit():
            ids.append(int(token))

    if not ids:
        return None

    ranked = [(cid, float(len(ids) - position)) for position, cid in enumerate(ids[:keep])]
    return ranked or None


def llm_available() -> bool:
    return bool(os.getenv("OPENAI_API_KEY"))


strategy = settings.RERANK_STRATEGY
_EFFECTIVE_STRATEGY = strategy
if strategy == "ce":
    ce_ok = ce_available()
    print(f"[RERANK] CE available? {ce_ok}")
    if not ce_ok:
        msg = (
            "CrossEncoder failed to load but RERANK_STRATEGY=ce. "
            "Continuing without rerank. "
            "Set RERANK_STRICT=true to abort on this error."
        )
        logger.warning("[RERANK] %s", msg)
        print(f"[RERANK] {msg}")
        _EFFECTIVE_STRATEGY = "none"
        if settings.RERANK_STRICT:
            raise RuntimeError(
                "RERANK_STRICT=true and CrossEncoder could not be loaded. "
                "Check model availability and retry."
            ) from _ce_error
elif strategy == "llm":
    print(f"[RERANK] Using LLM rerank model={settings.LLM_RERANK_MODEL}")
else:
    print("[RERANK] Rerank disabled (strategy=none)")


def effective_strategy() -> str:
    return _EFFECTIVE_STRATEGY
