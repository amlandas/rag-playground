type EnvLike = Record<string, string | undefined> | NodeJS.ProcessEnv;

const FALLBACK_API_BASE_URL = "https://rag-playground-api-908840126213.us-west1.run.app";

export function resolveApiBase(env: EnvLike = process.env): string {
  const cleaned = env?.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!cleaned) {
    return FALLBACK_API_BASE_URL;
  }
  return cleaned.replace(/\/$/, "") || FALLBACK_API_BASE_URL;
}

const API_BASE_URL = resolveApiBase();
export const API_BASE = API_BASE_URL;

let loggedBaseUrl = false;

export function getApiBaseUrl(): string {
  if (!loggedBaseUrl && typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.log("[rag-api] Using API base URL:", API_BASE_URL);
    loggedBaseUrl = true;
  }
  return API_BASE_URL;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const res = await fetch(url, { cache: "no-store" });
  return handle<T>(res);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return handle<T>(res);
}
