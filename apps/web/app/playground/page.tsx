"use client";

import { useCallback, useEffect, useState, type SVGProps } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AdvancedSettings from "../../components/AdvancedSettings";
import FeedbackBar from "../../components/FeedbackBar";
import HealthBadge from "../../components/HealthBadge";
import MetricsDrawer from "../../components/MetricsDrawer";
import Uploader from "../../components/Uploader";
import { useAuth } from "../../components/AuthProvider";
import { API_BASE } from "../../lib/api";
import {
  answerFromSnippetsSSE,
  buildIndex,
  compareRetrieval,
  fetchHealthDetails,
  fetchMetricsSummary,
  queryAdvancedGraph,
  querySSE,
  uploadFiles,
  type AdvancedQueryPayload,
} from "../../lib/rag-api";
import type {
  AdminMetricsSummary,
  AdvancedQueryResponse,
  AnswerMode,
  CompareProfile,
  ConfidenceLevel,
  HealthDetails,
  RetrievedChunk,
  RetrievedPrelude,
} from "../../lib/types";

const ANSWER_MODE_DEFAULT = (
  process.env.NEXT_PUBLIC_ANSWER_MODE_DEFAULT?.toLowerCase() === "blended" ? "blended" : "grounded"
) as AnswerMode;

function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 533.5 544.3" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="#EA4335"
        d="M533.5 278.4c0-17.4-1.5-34.1-4.3-50.4H272v95.4h147.5c-6.4 34.7-25.9 64.1-55.3 83.7v69.5h89.7c52.5-48.3 82.6-119.4 82.6-198.2z"
      />
      <path
        fill="#34A853"
        d="M272 544.3c74.9 0 137.7-24.9 183.6-67.6l-89.7-69.5c-24.2 16.3-55.2 25.8-93.9 25.8-72.3 0-133.6-48.7-155.7-114.1H23.5v71.6C69.1 477.1 164.3 544.3 272 544.3z"
      />
      <path
        fill="#FBBC05"
        d="M116.3 318.9c-10.3-30.7-10.3-64 0-94.7v-71.6H23.5c-44.5 88.9-44.5 193.6 0 282.5l92.8-71.6z"
      />
      <path
        fill="#4285F4"
        d="M272 107.7c40.7-.6 79.2 15.7 107.7 44.3l80.4-80.4C409.7 24.4 343.8-1.9 272 0 164.3 0 69.1 67.2 23.5 164.3l92.8 71.6C138.4 156.4 199.7 107.7 272 107.7z"
      />
    </svg>
  );
}

async function fetchSampleFiles(): Promise<File[]> {
  const samples = ["/samples/policy.txt", "/samples/paper.txt"];
  const out: File[] = [];
  for (const path of samples) {
    const res = await fetch(path);
    const blob = await res.blob();
    const name = path.split("/").pop() || "sample.txt";
    out.push(new File([blob], name, { type: blob.type || "text/plain" }));
  }
  return out;
}

function friendlyError(err: unknown): string {
  const message = String((err as { message?: string } | undefined)?.message ?? err ?? "").trim();
  const lower = message.toLowerCase();
  if (
    message.includes("413") ||
    lower.includes("too many files") ||
    lower.includes("exceeds") ||
    lower.includes("pdf too long")
  ) {
    return "Upload too large or exceeds limits. Try fewer or smaller files.";
  }
  if (message.includes("401") || lower.includes("authentication required")) {
    return "Sign in with Google to continue.";
  }
  if (message.includes("403") || lower.includes("admin access")) {
    return "Admin access required for this action.";
  }
  if (message.includes("429") || lower.includes("rate limit") || lower.includes("query cap")) {
    return "Session query limit reached. Please start a new session.";
  }
  return message || "Something went wrong.";
}

function LoadingBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600">
      <span className="inline-flex h-2 w-2 animate-ping rounded-full bg-blue-500" />
      {label}
    </span>
  );
}

const GRAPH_MODE_ENABLED = (process.env.NEXT_PUBLIC_GRAPH_RAG_ENABLED ?? "false").toLowerCase() === "true";
const LLM_RERANK_ALLOWED = (process.env.NEXT_PUBLIC_LLM_RERANK_ENABLED ?? "false").toLowerCase() === "true";
const FACT_CHECK_LLM_ALLOWED = (process.env.NEXT_PUBLIC_FACT_CHECK_LLM_ENABLED ?? "false").toLowerCase() === "true";

export default function Playground() {
  const {
    authEnabled,
    user,
    loading: authLoading,
    error: authError,
    signIn,
    signOut,
    refresh,
  } = useAuth();
  const authSatisfied = !authEnabled || !!user;
  const authGateActive = authEnabled && authLoading;
  const authRequired = authEnabled && !user;

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
  const clientIdPrefix = clientId ? `${clientId.slice(0, 8)}…` : "-";
  const apiBaseUrl = API_BASE;

  const [apiStatus, setApiStatus] = useState<{ state: "idle" | "checking" | "ok" | "error"; detail: string }>({
    state: "idle",
    detail: "",
  });
  const [refreshingSession, setRefreshingSession] = useState(false);
  const [metricsSummary, setMetricsSummary] = useState<AdminMetricsSummary | null>(null);
  const [healthDetails, setHealthDetails] = useState<HealthDetails | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [indexed, setIndexed] = useState(false);
  const [filesChosen, setFilesChosen] = useState<File[]>([]);
  const [busy, setBusy] = useState<"idle" | "uploading" | "indexing" | "querying" | "comparing">(
    "idle",
  );
  const [mode, setMode] = useState<"simple" | "advanced" | "graph">(
    GRAPH_MODE_ENABLED ? "graph" : "simple",
  );

  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [answerComplete, setAnswerComplete] = useState(false);
  const [answerMode, setAnswerMode] = useState<AnswerMode>(ANSWER_MODE_DEFAULT);
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [sources, setSources] = useState<RetrievedChunk[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [profileA, setProfileA] = useState<CompareProfile>({
    name: "A",
    k: 4,
    chunk_size: 800,
    overlap: 120,
    temperature: 0.2,
    model: "gpt-4o-mini",
  });
  const [profileB, setProfileB] = useState<CompareProfile>({
    name: "B",
    k: 6,
    chunk_size: 600,
    overlap: 150,
    temperature: 0.2,
    model: "gpt-4o-mini",
  });
  const [retrievedA, setRetrievedA] = useState<RetrievedChunk[]>([]);
  const [retrievedB, setRetrievedB] = useState<RetrievedChunk[]>([]);
const [answerA, setAnswerA] = useState("");
const [answerB, setAnswerB] = useState("");
const [answerAComplete, setAnswerAComplete] = useState(false);
const [answerBComplete, setAnswerBComplete] = useState(false);
const [queryId, setQueryId] = useState<string | null>(null);
  const [graphSettings, setGraphSettings] = useState({
    k: 6,
    maxHops: 2,
    temperature: 0.2,
    rerank: "ce" as "ce" | "llm",
    verificationMode: "ragv" as "none" | "ragv" | "llm",
  });
  const [graphResult, setGraphResult] = useState<AdvancedQueryResponse | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.info("[graph-rag] enabled:", GRAPH_MODE_ENABLED);
    }
  }, []);

  useEffect(() => {
    if (!GRAPH_MODE_ENABLED && mode === "graph") {
      setMode("simple");
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "graph") {
      setGraphResult(null);
    }
  }, [mode]);

  useEffect(() => {
    if (!LLM_RERANK_ALLOWED && graphSettings.rerank === "llm") {
      setGraphSettings((prev) => ({ ...prev, rerank: "ce" }));
    }
    if (!FACT_CHECK_LLM_ALLOWED && graphSettings.verificationMode === "llm") {
      setGraphSettings((prev) => ({ ...prev, verificationMode: "ragv" }));
    }
  }, [graphSettings.rerank, graphSettings.verificationMode]);

  const checkApiStatus = useCallback(async () => {
    setApiStatus({ state: "checking", detail: "" });
    try {
      const response = await fetch(`${apiBaseUrl}/api/health`, { cache: "no-store" });
      if (!response.ok) {
        const text = (await response.text().catch(() => "")) || response.statusText;
        throw new Error(`${response.status} ${text}`.trim());
      }
      setApiStatus({ state: "ok", detail: `reachable (${response.status})` });
    } catch (error: any) {
      const detail =
        typeof error?.message === "string"
          ? error.message
          : typeof error === "string"
            ? error
            : "Unknown error";
      setApiStatus({ state: "error", detail });
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void checkApiStatus();
  }, [checkApiStatus]);

  const handleRefreshSession = useCallback(async () => {
    if (!authEnabled) return;
    setRefreshingSession(true);
    try {
      await refresh();
    } catch (err) {
      console.error("[auth] session refresh failed", err);
    } finally {
      setRefreshingSession(false);
    }
  }, [authEnabled, refresh]);

  const loadAdminData = useCallback(async () => {
    setAdminLoading(true);
    try {
      const [metrics, health] = await Promise.all([fetchMetricsSummary(), fetchHealthDetails()]);
      setMetricsSummary(metrics);
      setHealthDetails(health);
      setAdminError(null);
    } catch (err) {
      console.error("[admin] metrics refresh failed", err);
      setAdminError(friendlyError(err));
    } finally {
      setAdminLoading(false);
    }
  }, []);

  const handleAdminRefresh = useCallback(() => {
    void loadAdminData();
  }, [loadAdminData]);

  const copyMarkdown = useCallback((value: string) => {
    if (!value) return;
    void navigator.clipboard.writeText(value).catch(() => {
      /* noop */
    });
  }, []);

  const downloadMarkdown = useCallback((value: string, fileName: string) => {
    if (!value) return;
    const blob = new Blob([value], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const confidenceStyles: Record<ConfidenceLevel, string> = {
    high: "border-emerald-300 bg-emerald-50 text-emerald-700",
    medium: "border-amber-300 bg-amber-50 text-amber-700",
    low: "border-rose-300 bg-rose-50 text-rose-700",
  };
  const confidenceLabels: Record<ConfidenceLevel, string> = {
    high: "High",
    medium: "Medium",
    low: "Low",
  };

  const modeButtonClass = (value: AnswerMode) =>
    `px-3 py-1 text-xs font-medium transition ${
      answerMode === value
        ? "bg-black text-white"
        : "bg-white text-gray-600 hover:bg-gray-100"
    }`;

  const renderMarkdown = (value: string, fallback: string) =>
    value ? (
      <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm max-w-none">
        {value}
      </ReactMarkdown>
    ) : (
      <p className="text-gray-500">{fallback}</p>
    );

  const canBuild =
    authSatisfied && !authGateActive && filesChosen.length > 0 && !!sessionId && !indexed && busy === "idle";
  const canQuery =
    authSatisfied && !authGateActive && indexed && query.trim().length > 0 && busy !== "querying";
  const canCompare =
    authSatisfied && !authGateActive && indexed && query.trim().length > 0 && busy !== "comparing";

  async function useSamples() {
    const files = await fetchSampleFiles();
    setFilesChosen(files);
    setSessionId(null);
    setIndexed(false);
    setAnswer("");
    setConfidence(null);
    setSources([]);
    setError(null);
    setQueryId(null);
  }

  function handleFilesSelected(files: File[]) {
    setFilesChosen(files);
    setSessionId(null);
    setIndexed(false);
    setAnswer("");
    setConfidence(null);
    setSources([]);
    setError(null);
    setQueryId(null);
  }

  async function doUpload() {
    if (!filesChosen.length) return;
    if (authRequired) {
      setError("Sign in with Google to upload files.");
      return;
    }
    if (authGateActive) return;
    setBusy("uploading");
    setError(null);
    try {
      const res = await uploadFiles(filesChosen);
      setSessionId(res.session_id);
      setIndexed(false);
      setQueryId(null);
    } catch (error: any) {
      setError(friendlyError(error));
    } finally {
      setBusy("idle");
    }
  }

  async function doIndex() {
    if (!sessionId) return;
    if (authRequired) {
      setError("Sign in with Google to build an index.");
      return;
    }
    if (authGateActive) return;
    setBusy("indexing");
    setError(null);
    try {
      await buildIndex(sessionId, { chunk_size: 800, overlap: 120 });
      setIndexed(true);
    } catch (error: any) {
      setError(friendlyError(error));
    } finally {
      setBusy("idle");
    }
  }

  async function doQuerySimple() {
    if (!sessionId) return;
    if (authRequired) {
      setError("Sign in with Google to run queries.");
      return;
    }
    if (authGateActive) return;
    setBusy("querying");
    setAnswer("");
    setAnswerComplete(false);
    setConfidence(null);
    setSources([]);
    setError(null);
    setQueryId(null);
    await querySSE(
      sessionId,
      { query, k: 4, similarity: "cosine", temperature: 0.2, model: "gpt-4o-mini", mode: answerMode },
      {
        onRetrieved: (payload: RetrievedPrelude) => {
          if (payload.query_id) {
            setQueryId(payload.query_id);
          }
          setConfidence(payload.confidence ?? null);
          setSources(payload.retrieved ?? []);
        },
        onToken: (token) => {
          setAnswer((prev) => prev + token);
        },
        onDone: () => {
          setBusy("idle");
          setAnswerComplete(true);
        },
        onError: (err) => {
          setError(friendlyError(err));
          setConfidence(null);
          setBusy("idle");
        },
      },
    );
  }

  const runGraphQuery = useCallback(async () => {
    if (!sessionId) return;
    if (authRequired) {
      setError("Sign in with Google to run queries.");
      return;
    }
    if (authGateActive) return;
    if (!indexed) {
      setError("Build an index before running Graph RAG queries.");
      return;
    }
    setBusy("querying");
    setAnswer("");
    setAnswerComplete(false);
    setSources([]);
    setGraphResult(null);
    setError(null);
    const sanitizedRerank = graphSettings.rerank === "llm" && !LLM_RERANK_ALLOWED ? "ce" : graphSettings.rerank;
    const sanitizedVerification =
      graphSettings.verificationMode === "llm" && !FACT_CHECK_LLM_ALLOWED
        ? "ragv"
        : graphSettings.verificationMode;
    try {
      const payload: AdvancedQueryPayload = {
        session_id: sessionId,
        query,
        k: graphSettings.k,
        max_hops: graphSettings.maxHops,
        temperature: graphSettings.temperature,
        rerank: sanitizedRerank,
        verification_mode: sanitizedVerification,
      };
      const response = await queryAdvancedGraph(payload);
      setAnswer(response.answer);
      setAnswerComplete(true);
      const normalizedSources: RetrievedChunk[] = response.subqueries.flatMap((sub) =>
        sub.retrieved_meta.map((meta) => ({
          rank: meta.rank,
          doc_id: meta.doc_id,
          start: meta.start,
          end: meta.end,
          text: meta.text,
          similarity: meta.dense_score,
          lexical_score: meta.lexical_score,
          fused_score: meta.fused_score,
          rerank_score: meta.rerank_score ?? undefined,
        })),
      );
      setSources(normalizedSources);
      setGraphResult(response);
    } catch (err: any) {
      setError(friendlyError(err));
      setGraphResult(null);
    } finally {
      setBusy("idle");
    }
  }, [
    sessionId,
    authRequired,
    authGateActive,
    indexed,
    graphSettings.k,
    graphSettings.maxHops,
    graphSettings.temperature,
    graphSettings.rerank,
    graphSettings.verificationMode,
    query,
  ]);

  async function doCompare() {
    if (!sessionId) return;
    if (authRequired) {
      setError("Sign in with Google to run comparisons.");
      return;
    }
    if (authGateActive) return;
    setBusy("comparing");
    setError(null);
    setRetrievedA([]);
    setRetrievedB([]);
    setAnswerA("");
    setAnswerB("");
    setAnswerAComplete(false);
    setAnswerBComplete(false);
    try {
      const result = await compareRetrieval({
        session_id: sessionId,
        query,
        profile_a: profileA,
        profile_b: profileB,
      });
      setRetrievedA(result.profile_a);
      setRetrievedB(result.profile_b);
    } catch (error: any) {
      setError(friendlyError(error));
      setBusy("idle");
      return;
    }

    try {
      let aborted = false;
      await answerFromSnippetsSSE(
        query,
        retrievedA.map(({ rank, text }) => ({ rank, text })),
        { model: profileA.model, temperature: profileA.temperature },
        {
          onToken: (token) => {
            setAnswerA((prev) => prev + token);
          },
          onDone: () => {
            setAnswerAComplete(true);
          },
          onError: (err) => {
            setError(friendlyError(err));
            setBusy("idle");
            aborted = true;
          },
        },
      );
      if (aborted) {
        return;
      }
      await answerFromSnippetsSSE(
        query,
        retrievedB.map(({ rank, text }) => ({ rank, text })),
        { model: profileB.model, temperature: profileB.temperature },
        {
          onToken: (token) => {
            setAnswerB((prev) => prev + token);
          },
          onDone: () => {
            setAnswerBComplete(true);
            setBusy("idle");
          },
          onError: (err) => {
            setError(friendlyError(err));
            setBusy("idle");
          },
        },
      );
    } catch (error: any) {
      setError(friendlyError(error));
      setBusy("idle");
    }
  }

  useEffect(() => {
    if (!filesChosen.length) {
      return;
    }
    if (authRequired) {
      setError("Sign in with Google to upload files.");
      return;
    }
    if (authGateActive) {
      return;
    }
    void doUpload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesChosen, authRequired, authGateActive]);

  useEffect(() => {
    if (mode !== "simple") {
      setQueryId(null);
      setConfidence(null);
    }
  }, [mode]);

  useEffect(() => {
    setConfidence(null);
  }, [answerMode]);

  useEffect(() => {
    if (authSatisfied) {
      setError((prev) => (prev && prev.toLowerCase().includes("sign in") ? null : prev));
    }
  }, [authSatisfied]);

  useEffect(() => {
    if (authEnabled && user?.is_admin) {
      void loadAdminData();
    } else {
      setMetricsSummary(null);
      setHealthDetails(null);
      setAdminError(null);
    }
  }, [authEnabled, user?.is_admin, loadAdminData]);

  return (
    <main className="grid min-h-screen grid-cols-12 gap-4 px-4 py-4">
      <div className="col-span-12 flex flex-wrap items-center justify-between gap-3">
        <div className="text-lg font-semibold">RAG Playground</div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Mode:</span>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as "simple" | "advanced" | "graph")}
              className="rounded border px-2 py-1 text-sm"
            >
              <option value="simple">Simple</option>
              <option value="advanced">Advanced (A/B)</option>
              {GRAPH_MODE_ENABLED ? <option value="graph">Graph RAG (multi-stage)</option> : null}
            </select>
            <span className="text-xs rounded-full border px-2 py-0.5 text-gray-600">
              Ephemeral • auto-cleans after 30m idle
            </span>
          </div>
          <MetricsDrawer />
          <HealthBadge />
          {authEnabled ? (
            user ? (
              <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="uppercase tracking-wide text-[10px] text-gray-500">Signed in as</span>
                  <span className="max-w-[180px] truncate font-semibold text-gray-900" title={user.email}>
                    {user.email}
                  </span>
                </div>
                {user.is_admin ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                    Admin
                  </span>
                ) : null}
                <button
                  onClick={() => signOut()}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                  disabled={authLoading}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => signIn()}
                className="flex items-center gap-2 rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-900 disabled:opacity-60"
                disabled={authLoading}
              >
                <GoogleIcon className="h-4 w-4" />
                <span>{authLoading ? "Loading…" : "Sign in with Google"}</span>
              </button>
            )
          ) : null}
      </div>
    </div>
      <section className="col-span-12 rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">API status</h2>
            <p className="text-xs text-gray-500">Using NEXT_PUBLIC_API_BASE_URL for all requests.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void checkApiStatus();
            }}
            className="rounded border px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
            disabled={apiStatus.state === "checking"}
          >
            {apiStatus.state === "checking" ? "Checking…" : "Refresh API status"}
          </button>
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-xs text-gray-700 sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-gray-600">Base URL</dt>
            <dd className="break-words">{apiBaseUrl}</dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-600">Connectivity</dt>
            <dd
              className={
                apiStatus.state === "ok"
                  ? "text-emerald-700"
                  : apiStatus.state === "error"
                    ? "text-red-600"
                    : "text-gray-600"
              }
            >
              {apiStatus.state === "ok"
                ? apiStatus.detail
                : apiStatus.state === "error"
                  ? `unreachable — ${apiStatus.detail}`
                  : "checking…"}
            </dd>
          </div>
        </dl>
        {apiStatus.state === "error" ? (
          <p className="mt-2 text-xs text-red-600">API check failed: {apiStatus.detail}</p>
        ) : null}

        {mode === "graph" ? (
          <div className="mt-3 grid gap-3 rounded-lg border border-dashed border-gray-300 p-3 text-xs text-gray-700 md:grid-cols-2">
            <div className="space-y-1">
              <label className="font-semibold text-gray-600">Top-k passages</label>
              <input
                type="number"
                min={1}
                max={12}
                value={graphSettings.k}
                onChange={(event) =>
                  setGraphSettings((prev) => ({ ...prev, k: Number(event.target.value) || 1 }))
                }
                className="w-full rounded border px-2 py-1"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-gray-600">Max graph hops</label>
              <input
                type="number"
                min={1}
                max={4}
                value={graphSettings.maxHops}
                onChange={(event) =>
                  setGraphSettings((prev) => ({ ...prev, maxHops: Number(event.target.value) || 1 }))
                }
                className="w-full rounded border px-2 py-1"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-gray-600">Temperature</label>
              <input
                type="number"
                step={0.1}
                min={0}
                max={1}
                value={graphSettings.temperature}
                onChange={(event) =>
                  setGraphSettings((prev) => ({ ...prev, temperature: Number(event.target.value) || 0 }))
                }
                className="w-full rounded border px-2 py-1"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-gray-600">Rerank strategy</label>
              <select
                value={graphSettings.rerank}
                onChange={(event) =>
                  setGraphSettings((prev) => ({ ...prev, rerank: event.target.value as "ce" | "llm" }))
                }
                className="w-full rounded border px-2 py-1"
              >
                <option value="ce">Cross-encoder</option>
                <option value="llm" disabled={!LLM_RERANK_ALLOWED}>
                  LLM rerank {LLM_RERANK_ALLOWED ? "" : "(disabled)"}
                </option>
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="font-semibold text-gray-600">Verification</label>
              <select
                value={graphSettings.verificationMode}
                onChange={(event) =>
                  setGraphSettings((prev) => ({
                    ...prev,
                    verificationMode: event.target.value as "none" | "ragv" | "llm",
                  }))
                }
                className="w-full rounded border px-2 py-1"
              >
                <option value="none">Skip verification</option>
                <option value="ragv">RAG-V cross-check</option>
                <option value="llm" disabled={!FACT_CHECK_LLM_ALLOWED}>
                  Fact-check LLM {FACT_CHECK_LLM_ALLOWED ? "" : "(disabled)"}
                </option>
              </select>
            </div>
          </div>
        ) : null}
      </section>
      {authEnabled ? (
        <div className="col-span-12 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Auth diagnostics</h2>
              <p className="text-xs text-gray-500">Client-side session information</p>
            </div>
            <button
              type="button"
              onClick={handleRefreshSession}
              className="rounded border px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
              disabled={refreshingSession}
            >
              {refreshingSession ? "Refreshing…" : "Refresh session"}
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-3 text-xs text-gray-700 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <dt className="font-semibold text-gray-600">Auth enabled</dt>
              <dd>{String(authEnabled)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-600">Client ID prefix</dt>
              <dd>{clientIdPrefix}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-600">Authenticated</dt>
              <dd>{String(!!user)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-600">Email</dt>
              <dd>{user?.email ?? "-"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-600">Is admin</dt>
              <dd>{String(user?.is_admin ?? false)}</dd>
            </div>
          </dl>
          {authError ? (
            <p className="mt-2 text-xs text-red-600">Authentication error: {authError}</p>
          ) : null}
        </div>
      ) : null}

      {authEnabled && user?.is_admin ? (
        <section className="col-span-12 space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Admin tools</h2>
            <button
              type="button"
              onClick={handleAdminRefresh}
              className="rounded border border-blue-300 bg-white px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60"
              disabled={adminLoading}
            >
              {adminLoading ? "Refreshing…" : "Refresh data"}
            </button>
          </div>
          {adminError ? <p className="text-xs text-red-700">{adminError}</p> : null}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded border border-white bg-white/80 p-3 text-xs text-gray-800 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Metrics summary
              </h3>
              {metricsSummary ? (
                <div className="mt-2 space-y-2">
                  <div className="flex justify-between">
                    <span>Total sessions</span>
                    <span className="font-semibold">{metricsSummary.total_sessions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total indices</span>
                    <span className="font-semibold">{metricsSummary.total_indices}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total queries</span>
                    <span className="font-semibold">{metricsSummary.total_queries}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-600">Queries by mode</p>
                    <ul className="mt-1 space-y-1 text-[11px]">
                      {Object.entries(metricsSummary.queries_by_mode).map(([mode, count]) => (
                        <li key={mode} className="flex justify-between">
                          <span>{mode}</span>
                          <span className="font-semibold">{count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-600">Queries by confidence</p>
                    <ul className="mt-1 space-y-1 text-[11px]">
                      {Object.entries(metricsSummary.queries_by_confidence).map(([level, count]) => (
                        <li key={level} className="flex justify-between">
                          <span>{level}</span>
                          <span className="font-semibold">{count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="text-[11px] text-gray-600">
                    <div>Last query: {metricsSummary.last_query_ts ?? "-"}</div>
                    <div>Last error: {metricsSummary.last_error_ts ?? "-"}</div>
                    <div>Rerank: {metricsSummary.rerank_strategy_current}</div>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500">Metrics will appear after activity.</p>
              )}
            </div>
            <div className="rounded border border-white bg-white/80 p-3 text-xs text-gray-800 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Health details
              </h3>
              {healthDetails ? (
                <dl className="mt-2 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>Status</span>
                    <span className="font-semibold">{healthDetails.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Effective rerank</span>
                    <span className="font-semibold">{healthDetails.rerank_strategy_effective}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Configured rerank</span>
                    <span>{healthDetails.rerank_strategy_configured}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CE available</span>
                    <span>{String(healthDetails.ce_available)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>LLM available</span>
                    <span>{String(healthDetails.llm_available)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Default mode</span>
                    <span>{healthDetails.answer_mode_default}</span>
                  </div>
                  {healthDetails.version ? (
                    <div className="flex justify-between">
                      <span>Version</span>
                      <span>{healthDetails.version}</span>
                    </div>
                  ) : null}
                </dl>
              ) : (
                <p className="mt-2 text-xs text-gray-500">Health details unavailable.</p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <aside className="col-span-3 space-y-4 rounded-xl border p-3">
        <div>
          <div className="mb-2 text-sm font-semibold">Files</div>
          <Uploader
            disabled={busy !== "idle" || authGateActive}
            onFilesSelected={handleFilesSelected}
            onUseSamples={useSamples}
          />
          <div className="mt-3 space-y-1">
            {filesChosen.length ? (
              filesChosen.map((file, index) => (
                <div key={`${file.name}-${index}`} className="truncate text-sm text-gray-700">
                  • {file.name}
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500">No files selected.</div>
            )}
          </div>
          <div className="mt-3">
            <button
              onClick={doIndex}
              disabled={!canBuild}
              className="rounded-lg bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {busy === "indexing" ? <LoadingBadge label="Indexing" /> : "Build index"}
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Session: {sessionId ? `${sessionId.slice(0, 8)}…` : "—"} · Indexed: {indexed ? "yes" : "no"}
          </div>
        </div>

        {mode === "advanced" ? (
          <div>
            <div className="mb-2 text-sm font-semibold">Profiles (A/B)</div>
            <AdvancedSettings
              valueA={profileA}
              valueB={profileB}
              onChange={(which, next) => (which === "A" ? setProfileA(next) : setProfileB(next))}
            />
          </div>
        ) : null}
      </aside>

      <section
        className={`rounded-xl border p-3 ${mode === "simple" ? "col-span-6" : "col-span-9"}`}
      >
        <div className="mb-2 text-sm font-semibold">Ask a question</div>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g., What is our PTO policy?"
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring"
          />
          {mode === "simple" && (
            <button
              onClick={doQuerySimple}
              className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
              disabled={!canQuery}
            >
              {busy === "querying" ? <LoadingBadge label="Running" /> : "Run"}
            </button>
          )}
          {mode === "advanced" && (
            <button
              onClick={doCompare}
              className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
              disabled={!canCompare}
            >
              {busy === "comparing" ? <LoadingBadge label="Comparing" /> : "Run A/B"}
            </button>
          )}
          {mode === "graph" && (
            <button
              onClick={() => {
                void runGraphQuery();
              }}
              className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
              disabled={
                !authSatisfied || authGateActive || !indexed || !query.trim() || busy === "querying"
              }
            >
              {busy === "querying" ? <LoadingBadge label="Graph RAG" /> : "Run Graph RAG"}
            </button>
          )}
        </div>
        {mode !== "graph" ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700">Answer mode:</span>
              <div className="flex overflow-hidden rounded-lg border border-gray-300">
                <button
                  type="button"
                  className={modeButtonClass("grounded")}
                  onClick={() => setAnswerMode("grounded")}
                >
                  Document-only
                </button>
                <button
                  type="button"
                  className={modeButtonClass("blended")}
                  onClick={() => setAnswerMode("blended")}
                >
                  Doc + world context
                </button>
              </div>
            </div>
            <div className="text-[11px] text-gray-500">
              World notes appear only in Doc + world context.
            </div>
          </div>
        ) : null}

        {mode === "graph" ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Graph RAG answer</div>
              {graphResult?.verification ? (
                <span className="rounded-full border px-2 py-1 text-xs font-semibold text-purple-700">
                  Verification: {graphResult.verification.verdict}
                </span>
              ) : null}
            </div>
            <div className="answer-body overflow-auto overflow-x-hidden max-h-[60vh] min-h-[200px] rounded-lg border p-3 text-sm text-gray-800 leading-relaxed">
              {graphResult ? renderMarkdown(graphResult.answer, "Graph RAG answer will appear here.") : "Graph RAG answer will appear here."}
            </div>
            {graphResult?.verification ? (
              <div className="rounded-lg border px-3 py-2 text-xs text-gray-600">
                <div className="font-semibold text-gray-700">Verification</div>
                <div>Mode: {graphResult.verification.mode}</div>
                <div>Coverage: {(graphResult.verification.coverage * 100).toFixed(0)}%</div>
                <div className="text-gray-700">{graphResult.verification.notes}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === "simple" ? (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">Answer</div>
              {confidence ? (
                <span
                  className={`rounded-full border px-2 py-1 font-medium ${confidenceStyles[confidence]}`}
                >
                  Confidence: {confidenceLabels[confidence]}
                </span>
              ) : null}
            </div>
            <div className="answer-body overflow-auto overflow-x-hidden max-h-[60vh] min-h-[200px] rounded-lg border p-3 text-sm text-gray-800 leading-relaxed">
              {renderMarkdown(answer, "Answer stream will appear here.")}
            </div>
            <div className="mt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => copyMarkdown(answer)}
                disabled={!answer}
                className="rounded border px-2 py-1 disabled:opacity-50"
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => downloadMarkdown(answer, "answer.md")}
                disabled={!answerComplete || !answer}
                className="rounded border px-2 py-1 disabled:opacity-50"
              >
                Download .md
              </button>
            </div>
            <div className="mt-2">
              <FeedbackBar queryId={queryId} />
            </div>
          </div>
        ) : null}

        {mode === "advanced" ? (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 text-sm font-semibold">Answer — Profile A</div>
              <div className="answer-body overflow-auto overflow-x-hidden max-h-[60vh] min-h-[160px] rounded-lg border p-3 text-sm text-gray-800 leading-relaxed">
                {renderMarkdown(answerA, "Answer A stream will appear here.")}
              </div>
              <div className="mt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => copyMarkdown(answerA)}
                  disabled={!answerA}
                  className="rounded border px-2 py-1 disabled:opacity-50"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => downloadMarkdown(answerA, "answer-profile-a.md")}
                  disabled={!answerAComplete || !answerA}
                  className="rounded border px-2 py-1 disabled:opacity-50"
                >
                  Download .md
                </button>
              </div>
              <div className="mt-2 rounded border p-2">
                <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Sources — A</div>
                {retrievedA.length ? (
                  <ul className="space-y-2">
                    {retrievedA.map((source) => (
                      <li key={source.rank} className="text-sm">
                        <div className="font-medium">[{source.rank}] doc {source.doc_id.slice(0, 8)}…</div>
                        <div className="text-gray-700 line-clamp-4">{source.text}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-gray-500">—</div>
                )}
              </div>
            </div>

            <div>
              <div className="mb-1 text-sm font-semibold">Answer — Profile B</div>
              <div className="answer-body overflow-auto overflow-x-hidden max-h-[60vh] min-h-[160px] rounded-lg border p-3 text-sm text-gray-800 leading-relaxed">
                {renderMarkdown(answerB, "Answer B stream will appear here.")}
              </div>
              <div className="mt-2 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => copyMarkdown(answerB)}
                  disabled={!answerB}
                  className="rounded border px-2 py-1 disabled:opacity-50"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => downloadMarkdown(answerB, "answer-profile-b.md")}
                  disabled={!answerBComplete || !answerB}
                  className="rounded border px-2 py-1 disabled:opacity-50"
                >
                  Download .md
                </button>
              </div>
              <div className="mt-2 rounded border p-2">
                <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Sources — B</div>
                {retrievedB.length ? (
                  <ul className="space-y-2">
                    {retrievedB.map((source) => (
                      <li key={source.rank} className="text-sm">
                        <div className="font-medium">[{source.rank}] doc {source.doc_id.slice(0, 8)}…</div>
                        <div className="text-gray-700 line-clamp-4">{source.text}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-gray-500">—</div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {mode === "graph" && graphResult ? (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-semibold text-gray-800">Diagnostics</div>
            </div>
            <div className="space-y-3">
              {graphResult.subqueries.map((sub) => (
                <div key={sub.query} className="rounded border border-white bg-white/70 p-2 shadow-sm">
                  <div className="text-sm font-semibold text-gray-800">{sub.query}</div>
                  <div className="text-gray-600">{sub.answer}</div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    Hops: {sub.metrics.hops_used ?? "-"} · Graph hits: {sub.metrics.graph_candidates ?? "-"} · Hybrid hits: {sub.metrics.hybrid_candidates ?? "-"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </section>

      {mode === "simple" ? (
        <aside className="col-span-3 rounded-xl border p-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold">Explainability</div>
            <span className="rounded-full border px-2 py-0.5 text-xs">Simple Mode</span>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Sources</div>
            <div className="rounded-lg border p-2">
              {sources.length ? (
                <ul className="space-y-2">
                  {sources.map((source) => (
                    <li key={source.rank} className="text-sm">
                      <div className="font-medium">[{source.rank}] doc {source.doc_id.slice(0, 8)}…</div>
                      <div className="text-gray-700 line-clamp-4">{source.text}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-500">Retrieved chunks will show here.</div>
              )}
            </div>
          </div>
        </aside>
      ) : null}
    </main>
  );
}
