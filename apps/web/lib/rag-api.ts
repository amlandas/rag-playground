import { API_BASE } from "./api";
import { postSSE } from "./sse";
import type {
  CompareRequest,
  CompareResult,
  IndexResponse,
  MetricsResponse,
  RetrievedChunk,
  UploadResponse,
} from "./types";

type QueryPayload = {
  query: string;
  k?: number;
  similarity?: "cosine" | "l2";
  temperature?: number;
  model?: string;
  rerank?: boolean;
};

type SSEHandlers = Parameters<typeof postSSE>[2];

export async function uploadFiles(files: File[]): Promise<UploadResponse> {
  const url = `${API_BASE}/api/upload`;
  const form = new FormData();
  for (const file of files) {
    form.append("files", file, file.name);
  }
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return (await res.json()) as UploadResponse;
}

export async function buildIndex(
  session_id: string,
  opts?: { chunk_size?: number; overlap?: number; embed_model?: string }
): Promise<IndexResponse> {
  const url = `${API_BASE}/api/index`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id,
      chunk_size: opts?.chunk_size ?? 800,
      overlap: opts?.overlap ?? 120,
      embed_model: opts?.embed_model ?? "text-embedding-3-large",
    }),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return (await res.json()) as IndexResponse;
}

export async function querySSE(
  session_id: string,
  body: QueryPayload,
  handlers: SSEHandlers
) {
  const url = `${API_BASE}/api/query`;
  const payload = {
    session_id,
    query: body.query,
    k: body.k ?? 4,
    similarity: body.similarity ?? "cosine",
    temperature: body.temperature ?? 0.2,
    model: body.model ?? "gpt-4o-mini",
    rerank: body.rerank ?? false,
  };

  await postSSE(url, payload, handlers);
}

export async function compareRetrieval(body: CompareRequest): Promise<CompareResult> {
  const res = await fetch(`${API_BASE}/api/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
  const url = `${API_BASE}/api/answer_from_snippets`;
  await postSSE(url, payload, handlers);
}

export async function sendFeedback(query_id: string, rating: -1 | 1, reason?: string) {
  const res = await fetch(`${API_BASE}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query_id, rating, reason }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function fetchMetrics(limit = 25): Promise<MetricsResponse> {
  const res = await fetch(`${API_BASE}/api/metrics?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}
