from __future__ import annotations

from typing import List

import fitz  # type: ignore[attr-defined]


def extract_text_from_pdf_bytes(data: bytes) -> str:
    with fitz.open(stream=data, filetype="pdf") as doc:
        texts: List[str] = []
        for page in doc:
            texts.append(page.get_text())
    return "\n".join(texts)


def extract_text_from_txt_bytes(data: bytes, encoding: str = "utf-8") -> str:
    try:
        return data.decode(encoding, errors="ignore")
    except Exception:
        return data.decode("utf-8", errors="ignore")
