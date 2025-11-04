from __future__ import annotations

import uuid
from typing import List

import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..config import settings
from ..schemas import IndexRequest, IndexResponse, UploadResponse
from ..services.chunk import chunk_text
from ..services.embed import embed_texts
from ..services.extract import extract_text_from_pdf_bytes, extract_text_from_txt_bytes
from ..services.index import build_faiss_index
from ..services.retrieve import build_bm25
from ..services.session import SessionIndex, ensure_session, new_session, set_session_index
from ..services.observability import record_index_built
from ..services.session_auth import SessionUser, get_session_user, maybe_require_auth

router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
async def upload(
    files: List[UploadFile] = File(...),
    user: SessionUser | None = Depends(get_session_user),
):
    maybe_require_auth(user)
    if len(files) > settings.MAX_FILES_PER_UPLOAD:
        raise HTTPException(
            status_code=413,
            detail=f"Too many files: max {settings.MAX_FILES_PER_UPLOAD}",
        )

    sid = new_session()
    doc_ids = []
    sess = ensure_session(sid)
    for f in files:
        data = await f.read()
        size_mb = len(data) / (1024 * 1024)
        if size_mb > settings.MAX_FILE_MB:
            raise HTTPException(
                status_code=413,
                detail=f"File {f.filename} exceeds {settings.MAX_FILE_MB} MB",
            )
        ext = (f.filename or "").lower()
        if ext.endswith(".pdf"):
            try:
                import fitz  # type: ignore[attr-defined]
            except ImportError as exc:
                raise HTTPException(status_code=500, detail="PDF support not available") from exc

            try:
                with fitz.open(stream=data, filetype="pdf") as doc:
                    if doc.page_count > settings.MAX_PAGES_PER_PDF:
                        raise HTTPException(
                            status_code=413,
                            detail=f"PDF too long: max {settings.MAX_PAGES_PER_PDF} pages",
                        )
                text = extract_text_from_pdf_bytes(data)
            except HTTPException:
                raise
            except Exception as exc:
                raise HTTPException(status_code=400, detail="Failed to read PDF") from exc
        elif ext.endswith(".txt") or ext.endswith(".md"):
            text = extract_text_from_txt_bytes(data)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type; use PDF, TXT, or MD.")
        doc_id = str(uuid.uuid4())
        sess["docs"][doc_id] = {"name": f.filename, "text": text}
        doc_ids.append(doc_id)
    return UploadResponse(session_id=sid, doc_ids=doc_ids)


@router.post("/index", response_model=IndexResponse)
async def build_index(
    req: IndexRequest,
    user: SessionUser | None = Depends(get_session_user),
):
    maybe_require_auth(user)
    sess = ensure_session(req.session_id)
    if not sess["docs"]:
        raise HTTPException(status_code=400, detail="No documents uploaded for this session.")
    chunk_map = []
    all_chunks = []
    for doc_id, doc in sess["docs"].items():
        chunks = chunk_text(doc["text"], chunk_size=req.chunk_size, overlap=req.overlap)
        for (start, end, ch_txt) in chunks:
            chunk_map.append((doc_id, start, end, ch_txt))
            all_chunks.append(ch_txt)
    X = embed_texts(all_chunks, model=req.embed_model)
    X = X.astype(np.float32)
    norms = np.linalg.norm(X, axis=1, keepdims=True) + 1e-8
    X_norm = X / norms
    faiss_index = build_faiss_index(X_norm, metric="cosine")
    bm25_index, bm25_tokens = build_bm25(all_chunks)
    idx_id = str(uuid.uuid4())
    sess["index"] = {"faiss": faiss_index, "chunk_map": chunk_map, "embed_model": req.embed_model}
    set_session_index(
        req.session_id,
        SessionIndex(
            faiss_index=faiss_index,
            chunk_map=chunk_map,
            embeddings=X_norm,
            texts=all_chunks,
            bm25=bm25_index,
            bm25_tokens=bm25_tokens,
            embed_model=req.embed_model,
        ),
    )
    record_index_built()
    return IndexResponse(index_id=idx_id)
