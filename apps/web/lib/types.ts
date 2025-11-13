export type UploadResponse = { session_id: string; doc_ids: string[] };
export type IndexResponse = { index_id: string };

export type AnswerMode = "grounded" | "blended";

export type AuthUser = {
  email: string;
  is_admin: boolean;
};

export type AuthSession =
  | { authenticated: false }
  | ({ authenticated: true } & AuthUser);

export type RetrievedChunk = {
  rank: number;
  doc_id: string;
  start: number;
  end: number;
  text: string;
  similarity?: number;
  lexical_score?: number;
  fused_score?: number;
  rerank_score?: number;
  citation_id?: number | null;
};

export type ConfidenceLevel = "high" | "medium" | "low";

export type RetrievedPrelude = {
  query_id?: string;
  retrieved: RetrievedChunk[];
  citations?: Array<{ id: number; meta: Record<string, unknown> }>;
  mode?: AnswerMode;
  confidence?: ConfidenceLevel | null;
};

export type CompareProfile = {
  name: string;
  k: number;
  chunk_size: number;
  overlap: number;
  temperature?: number;
  model?: string;
  rerank?: boolean;
};

export type CompareRequest = {
  session_id: string;
  query: string;
  profile_a: CompareProfile;
  profile_b: CompareProfile;
};

export type CompareResult = {
  profile_a: RetrievedChunk[];
  profile_b: RetrievedChunk[];
};

export type AdminMetricsSummary = {
  count: number;
  avg_latency_ms: number | null;
  avg_top_sim: number | null;
  by_model: Record<string, number>;
};

export type MetricsEvent = {
  query_id: string;
  latency_ms: number;
  k: number;
  top_similarity: number | null;
  model: string;
  temperature: number;
  prompt_tokens_est: number;
  output_tokens_est: number;
  ts: number;
};

export type MetricsResponse = {
  summary: MetricsSummary;
  events: MetricsEvent[];
  feedback: { query_id: string; rating: number; reason?: string; ts: number }[];
};

export type MetricsSummary = {
  total_sessions: number;
  total_indices: number;
  total_queries: number;
  queries_by_mode: {
    grounded: number;
    blended: number;
  };
  queries_by_confidence: {
    high: number;
    medium: number;
    low: number;
  };
  last_query_ts: string | null;
  last_error_ts: string | null;
  rerank_strategy_current: string;
  rerank_strategy_configured: string;
  answer_mode_default: string;
};

export type HealthDetails = {
  status: string;
  rerank_strategy_effective: string;
  rerank_strategy_configured: string;
  ce_available: boolean;
  llm_available: boolean;
  answer_mode_default: string;
  version?: string;
};

export type AdvancedRetrievedMeta = {
  rank: number;
  chunk_index: number;
  doc_id: string;
  start: number;
  end: number;
  text: string;
  dense_score?: number;
  lexical_score?: number;
  fused_score?: number;
  rerank_score?: number;
};

export type AdvancedSubQueryResult = {
  query: string;
  retrieved_meta: AdvancedRetrievedMeta[];
  graph_paths: Array<Record<string, unknown>>;
  rerank_scores: number[];
  metrics: Record<string, number>;
  answer: string;
  citations: Array<Record<string, unknown>>;
};

export type AdvancedVerificationSummary = {
  mode: string;
  verdict: string;
  coverage: number;
  notes: string;
};

export type AdvancedQueryResponse = {
  session_id: string;
  query: string;
  planner: Record<string, unknown>;
  subqueries: AdvancedSubQueryResult[];
  answer: string;
  citations: Array<Record<string, unknown>>;
  verification?: AdvancedVerificationSummary | null;
};
