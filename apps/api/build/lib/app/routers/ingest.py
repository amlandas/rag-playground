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
from ..services.graph import build_graph_store
from ..services import gcs_ingestion
from ..services.index import build_faiss_index
from ..services.retrieve import build_bm25
from ..services.session import SessionIndex, ensure_session, new_session, set_session_index
from ..services.observability import record_index_built
from ..services.session_auth import SessionUser, get_session_user, maybe_require_auth
from ..services.runtime_config import get_runtime_config

router = APIRouter()


def _detect_file_type(filename: str) -> str:
    ext = (filename or "").lower()
    if ext.endswith(".pdf"):
        return "pdf"
    if ext.endswith(".txt") or ext.endswith(".md"):
        return "text"
    raise HTTPException(status_code=400, detail="Unsupported file type; use PDF, TXT, or MD.")


def _extract_text_from_bytes(data: bytes, filename: str) -> str:
    file_type = _detect_file_type(filename)
    if file_type == "pdf":
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
            return extract_text_from_pdf_bytes(data)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Failed to read PDF") from exc
    return extract_text_from_txt_bytes(data)


def _load_document_text(session_id: str, doc_id: str, doc: dict) -> str:
    storage = doc.get("storage") or "memory"
    if storage == "gcs":
        object_path = doc.get("object_path")
        if not object_path:
            raise HTTPException(status_code=500, detail="Document missing GCS object path.")
        try:
            raw = gcs_ingestion.download_blob_bytes(object_path)
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        return _extract_text_from_bytes(raw, doc.get("name") or "document")
    text = doc.get("text")
    if text is None:
        raise HTTPException(status_code=500, detail="Document text missing.")
    return text


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
    gcs_cfg = gcs_ingestion.get_gcs_ingestion_config()
    use_gcs = gcs_cfg.enabled
    if use_gcs and not gcs_cfg.bucket:
        raise HTTPException(status_code=500, detail="GCS ingestion is enabled but the bucket is not configured.")

    for f in files:
        data = await f.read()
        size_mb = len(data) / (1024 * 1024)
        if size_mb > settings.MAX_FILE_MB:
            raise HTTPException(
                status_code=413,
                detail=f"File {f.filename} exceeds {settings.MAX_FILE_MB} MB",
            )
        doc_id = str(uuid.uuid4())
        filename = f.filename or "upload"
        _ = _detect_file_type(filename)  # validate extension early
        if use_gcs:
            try:
                object_path = gcs_ingestion.upload_file_for_session(sid, doc_id, filename, data)
            except RuntimeError as exc:
                raise HTTPException(status_code=500, detail=str(exc)) from exc
            sess["docs"][doc_id] = {
                "name": filename,
                "storage": "gcs",
                "object_path": object_path,
                "mime_type": f.content_type or "",
                "size": len(data),
            }
        else:
            text = _extract_text_from_bytes(data, filename)
            sess["docs"][doc_id] = {"name": filename, "storage": "memory", "text": text}
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
        text = _load_document_text(req.session_id, doc_id, doc)
        chunks = chunk_text(text, chunk_size=req.chunk_size, overlap=req.overlap)
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
    graph_store = None
    if get_runtime_config().features.graph_enabled:
        graph_store = build_graph_store(sess["docs"], chunk_map)
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
            graph=graph_store,
        ),
    )
    record_index_built()
    return IndexResponse(index_id=idx_id)
