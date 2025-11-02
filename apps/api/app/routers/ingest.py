from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, File, HTTPException, UploadFile

from ..config import settings
from ..schemas import IndexRequest, IndexResponse, UploadResponse
from ..services.chunk import chunk_text
from ..services.embed import embed_texts
from ..services.extract import extract_text_from_pdf_bytes, extract_text_from_txt_bytes
from ..services.index import build_faiss_index
from ..services.session import ensure_session, new_session

router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
async def upload(files: List[UploadFile] = File(...)):
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
async def build_index(req: IndexRequest):
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
    faiss_index = build_faiss_index(X, metric="cosine")
    idx_id = str(uuid.uuid4())
    sess["index"] = {"faiss": faiss_index, "chunk_map": chunk_map, "embed_model": req.embed_model}
    return IndexResponse(index_id=idx_id)
