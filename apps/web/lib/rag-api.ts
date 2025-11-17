import { getApiBaseUrl } from "./api";
import { postSSE } from "./sse";
import type {
  AdminMetricsSummary,
  AdvancedQueryResponse,
  AnswerMode,
  AuthSession,
  AuthUser,
  CompareRequest,
  CompareResult,
  GraphRagTrace,
  HealthDetails,
  IndexResponse,
  MetricsResponse,
  RetrievedChunk,
  UploadResponse,
} from "./types";

export type QueryPayload = {
  query: string;
  k?: number;
  similarity?: "cosine" | "l2";
  temperature?: number;
  model?: string;
  rerank?: boolean;
  mode?: AnswerMode;
};

type SSEHandlers = Parameters<typeof postSSE>[2];

export function buildQueryPayload(session_id: string, body: QueryPayload) {
  return {
    session_id,
    query: body.query,
    k: body.k ?? 4,
    similarity: body.similarity ?? "cosine",
    temperature: body.temperature ?? 0.2,
    model: body.model ?? "gpt-4o-mini",
    rerank: body.rerank ?? false,
    mode: body.mode ?? undefined,
  };
}

export async function uploadFiles(files: File[]): Promise<UploadResponse> {
  const url = `${getApiBaseUrl()}/api/upload`;
  const form = new FormData();
  for (const file of files) {
    form.append("files", file, file.name);
  }
  const res = await fetch(url, { method: "POST", body: form, credentials: "include" });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return (await res.json()) as UploadResponse;
}

export async function buildIndex(
  sessionId: string,
  opts: { chunk_size?: number; overlap?: number; embed_model?: string } = {}
): Promise<IndexResponse> {
  const url = `${getApiBaseUrl()}/api/index`;
  const body = {
    session_id: sessionId,
    chunk_size: opts.chunk_size ?? 800,
    overlap: opts.overlap ?? 120,
    embed_model: opts.embed_model ?? "text-embedding-3-large",
  };
  console.log("[buildIndex] POST", url, body);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[buildIndex] non-OK", res.status, text);
    throw new Error(text || `HTTP ${res.status}`);
  }

  const json = (await res.json()) as IndexResponse;
  console.log("[buildIndex] OK", json);
  return json;
}

export async function querySSE(
  session_id: string,
  body: QueryPayload,
  handlers: SSEHandlers
) {
  const url = `${getApiBaseUrl()}/api/query`;
  const payload = buildQueryPayload(session_id, body);

  await postSSE(url, payload, handlers);
}

export async function compareRetrieval(body: CompareRequest): Promise<CompareResult> {
  const res = await fetch(`${getApiBaseUrl()}/api/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return (await res.json()) as CompareResult;
}

export async function answerFromSnippetsSSE(
  prompt: string,
  snippets: Pick<RetrievedChunk, "rank" | "text">[],
  opts: { model?: string; temperature?: number },
  handlers: SSEHandlers
) {
  const payload = {
    prompt,
    snippets: snippets.map((snippet) => ({ rank: snippet.rank, text: snippet.text })),
    model: opts.model ?? "gpt-4o-mini",
    temperature: opts.temperature ?? 0.2,
  };
  const url = `${getApiBaseUrl()}/api/answer_from_snippets`;
  await postSSE(url, payload, handlers);
}

export async function sendFeedback(query_id: string, rating: -1 | 1, reason?: string) {
  const res = await fetch(`${getApiBaseUrl()}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query_id, rating, reason }),
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function fetchMetrics(limit = 25): Promise<MetricsResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/metrics?limit=${limit}`, {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function fetchMetricsSummary(): Promise<AdminMetricsSummary> {
  const res = await fetch(`${getApiBaseUrl()}/api/metrics/summary`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return (await res.json()) as AdminMetricsSummary;
}

export async function fetchHealthDetails(): Promise<HealthDetails> {
  const res = await fetch(`${getApiBaseUrl()}/api/health/details`, {
    method: "GET",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return (await res.json()) as HealthDetails;
}

export async function fetchSession(): Promise<AuthSession> {
  const res = await fetch(`${getApiBaseUrl()}/api/auth/me`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return (await res.json()) as AuthSession;
}

export async function loginWithGoogle(idToken: string): Promise<AuthUser> {
  const res = await fetch(`${getApiBaseUrl()}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return (await res.json()) as AuthUser;
}

export async function logoutSession(): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}

export type AdvancedQueryPayload = {
  session_id: string;
  query: string;
  k: number;
  max_hops: number;
  temperature: number;
  rerank: "ce" | "llm";
  verification_mode: "none" | "ragv" | "llm";
  max_subqueries?: number;
};

export async function queryAdvancedGraph(body: AdvancedQueryPayload): Promise<AdvancedQueryResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/query/advanced`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return (await res.json()) as AdvancedQueryResponse;
}

export async function fetchGraphTrace(sessionId: string, requestId: string): Promise<GraphRagTrace> {
  const res = await fetch(`${getApiBaseUrl()}/api/query/advanced/trace/${sessionId}/${requestId}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return (await res.json()) as GraphRagTrace;
}
