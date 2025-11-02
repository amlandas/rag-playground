from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..schemas import CompareRequest
from ..services.chunk import chunk_text
from ..services.embed import embed_texts
from ..services.index import build_faiss_index, search_index
from ..services.session import ensure_session

router = APIRouter()


@router.post("/compare")
async def compare(req: CompareRequest):
    sess = ensure_session(req.session_id)
    if not sess.get("docs"):
        raise HTTPException(status_code=400, detail="No documents for this session.")

    def build_profile(profile):
        chunk_map = []
        all_chunks = []
        for doc_id, doc in sess["docs"].items():
            chunks = chunk_text(doc["text"], chunk_size=profile.chunk_size, overlap=profile.overlap)
            for (start, end, ch_txt) in chunks:
                chunk_map.append((doc_id, start, end, ch_txt))
                all_chunks.append(ch_txt)
        X = embed_texts(all_chunks)
        idx = build_faiss_index(X, metric="cosine")
        qv = embed_texts([req.query])
        D, I = search_index(idx, qv, k=profile.k, metric="cosine")
        retrieved = []
        for rank, row_idx in enumerate(I[0], start=1):
            if row_idx < 0 or row_idx >= len(chunk_map):
                continue
            (doc_id, start, end, txt) = chunk_map[row_idx]
            retrieved.append({"rank": rank, "doc_id": doc_id, "start": start, "end": end, "text": txt})
        return retrieved

    a = build_profile(req.profile_a)
    b = build_profile(req.profile_b)
    return {"profile_a": a, "profile_b": b}
