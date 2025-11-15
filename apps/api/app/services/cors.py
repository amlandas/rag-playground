from __future__ import annotations

from typing import List, Tuple

DEFAULT_LOCAL_ORIGINS: Tuple[str, ...] = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)


def parse_cors_origins(raw: str | None) -> List[str]:
    """Split and normalize comma-delimited origins."""
    if not raw:
        return []
    origins: List[str] = []
    for chunk in raw.split(","):
        origin = chunk.strip()
        if not origin or origin in origins:
            continue
        origins.append(origin)
    return origins


def effective_cors_origins(raw: str | None) -> List[str]:
    """Return configured origins or a safe default list."""
    parsed = parse_cors_origins(raw)
    if parsed:
        return parsed
    return list(DEFAULT_LOCAL_ORIGINS)


def cors_config_summary(raw: str | None) -> Tuple[List[str], str]:
    """Return origins and a description of where they came from."""
    parsed = parse_cors_origins(raw)
    if parsed:
        return parsed, "env"
    return list(DEFAULT_LOCAL_ORIGINS), "default"
