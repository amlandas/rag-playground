export type UploadResponse = { session_id: string; doc_ids: string[] };
export type IndexResponse = { index_id: string };

export type RetrievedChunk = {
  rank: number;
  doc_id: string;
  start: number;
  end: number;
  text: string;
};

export type RetrievedPrelude = { retrieved: RetrievedChunk[] };

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

export type MetricsSummary = {
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
