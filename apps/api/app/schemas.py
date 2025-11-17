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
    rerank_scores: List[float]
    metrics: Dict[str, float | int]
    answer: str
    citations: List[Dict[str, Any]]


class AdvancedQueryRequest(BaseModel):
    session_id: str
    query: str
    k: Optional[int] = None
    max_hops: Optional[int] = None
    temperature: Optional[float] = None
    rerank: Optional[Literal["ce", "llm"]] = None
    verification_mode: Optional[Literal["none", "ragv", "llm"]] = None
    max_subqueries: Optional[int] = None
    model: Optional[str] = None


class VerificationSummary(BaseModel):
    mode: str
    verdict: str
    coverage: float
    notes: str


class GraphRagTraceConfig(BaseModel):
    k: int
    max_hops: int
    temperature: float
    rerank_strategy: str
    verification_mode: str
    model: str
    max_subqueries: int


class GraphRagTracePlannerStep(BaseModel):
    id: int
    text: str
    stage: str = "sub-query"
    tags: List[str] = []


class GraphRagTracePlanner(BaseModel):
    sub_queries: List[GraphRagTracePlannerStep]
    notes: Optional[str] = None


class GraphRagTraceDocument(BaseModel):
    doc_id: str
    chunk_index: int
    rank: int
    snippet: Optional[str] = None
    dense_score: Optional[float] = None
    lexical_score: Optional[float] = None
    fused_score: Optional[float] = None
    rerank_score: Optional[float] = None


class GraphRagTraceRetrieval(BaseModel):
    sub_query: str
    documents: List[GraphRagTraceDocument]
    graph_paths: List[Dict[str, Any]]
    metrics: Dict[str, float | int]


class GraphRagTraceRerank(BaseModel):
    strategy: str
    latency_ms: float
    top_documents: List[GraphRagTraceDocument]


class GraphRagTraceSummary(BaseModel):
    text: str
    citations: List[str]


class GraphRagTraceSubQueryTrace(BaseModel):
    id: int
    query: str
    retrieval: GraphRagTraceRetrieval
    rerank: Optional[GraphRagTraceRerank] = None
    summary: GraphRagTraceSummary
    warnings: List[str] = []


class GraphRagTraceSynthesis(BaseModel):
    answer: str
    citations: List[Dict[str, Any]]
    model: str
    notes: Optional[str] = None


class GraphRagTrace(BaseModel):
    request_id: str
    session_id: str
    query: str
    timestamp: str
    config: GraphRagTraceConfig
    planner: GraphRagTracePlanner
    subqueries: List[GraphRagTraceSubQueryTrace]
    verification: Optional[VerificationSummary] = None
    synthesis: GraphRagTraceSynthesis
    warnings: List[str] = []


class AdvancedQueryResponse(BaseModel):
    session_id: str
    request_id: str
    query: str
    planner: Dict[str, Any]
    subqueries: List[AdvancedSubQuery]
    answer: str
    citations: List[Dict[str, Any]]
    verification: Optional[VerificationSummary] = None
    trace: Optional[GraphRagTrace] = None
