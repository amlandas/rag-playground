from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel


class UploadResponse(BaseModel):
    session_id: str
    doc_ids: List[str]


class IndexRequest(BaseModel):
    session_id: str
    chunk_size: int = 800
    overlap: int = 120
    embed_model: str = "text-embedding-3-large"


class IndexResponse(BaseModel):
    index_id: str


class QueryRequest(BaseModel):
    session_id: str
    query: str
    k: int = 8
    similarity: Literal["cosine", "l2"] = "cosine"
    temperature: float = 0.2
    model: str = "gpt-4o-mini"
    rerank: bool = False
    mode: Optional[Literal["grounded", "blended"]] = None


class RetrievedChunk(BaseModel):
    chunk_id: str
    doc_id: str
    text: str
    score: float
    rank: int


class CompareProfile(BaseModel):
    name: str
    k: int
    chunk_size: int
    overlap: int
    temperature: float = 0.2
    model: str = "gpt-4o-mini"
    rerank: bool = False


class CompareRequest(BaseModel):
    session_id: str
    query: str
    profile_a: CompareProfile
    profile_b: CompareProfile


class FeedbackRequest(BaseModel):
    query_id: str
    rating: int
    reason: Optional[str] = None


class Snippet(BaseModel):
    rank: int
    text: str


class AnswerFromSnippetsRequest(BaseModel):
    prompt: str
    snippets: List[Snippet]
    model: str = "gpt-4o-mini"
    temperature: float = 0.2


class AdvancedRetrievedMeta(BaseModel):
    rank: int
    chunk_index: int
    doc_id: str
    start: int
    end: int
    text: str
    dense_score: float | None = None
    lexical_score: float | None = None
    fused_score: float | None = None
    rerank_score: float | None = None


class AdvancedSubQuery(BaseModel):
    query: str
    retrieved_meta: List[AdvancedRetrievedMeta]
    graph_paths: List[Dict[str, Any]]
    ce_rerank_scores: List[float]
    metrics: Dict[str, float | int]


class AdvancedQueryRequest(BaseModel):
    session_id: str
    query: str
    max_hops: Optional[int] = None


class AdvancedQueryResponse(BaseModel):
    session_id: str
    query: str
    planner: Dict[str, Any]
    subqueries: List[AdvancedSubQuery]
