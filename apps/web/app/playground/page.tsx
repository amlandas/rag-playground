"use client";

import React, { useCallback, useEffect, useState, type SVGProps } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AdvancedSettings from "../../components/AdvancedSettings";
import FeedbackBar from "../../components/FeedbackBar";
import GraphRagTraceViewer from "../../components/GraphRagTraceViewer";
import HealthBadge from "../../components/HealthBadge";
import MetricsDrawer from "../../components/MetricsDrawer";
import Uploader from "../../components/Uploader";
import UploadLimitHint from "../../components/UploadLimitHint";
import SkeletonLine, { SkeletonBlock } from "../../components/Skeletons";
import { useAuth } from "../../components/AuthProvider";
import { useTour } from "../../components/TourProvider";
import { shouldAutoStartWalkthrough } from "../../lib/walkthroughStorage";
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
import { formatBytesInMB, UPLOAD_MAX_FILE_BYTES, UPLOAD_MAX_FILE_MB } from "../../lib/uploadLimits";
import type {
  AdminMetricsSummary,
  AdvancedQueryResponse,
  AnswerMode,
  CompareProfile,
  ConfidenceLevel,
  GraphRagTrace,
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
type PlaygroundMode = "simple" | "advanced" | "graph";
const MODE_TAB_CONFIG: Array<{ value: PlaygroundMode; label: string; panelId: string }> = [
  { value: "simple", label: "Simple", panelId: "mode-panel-simple" },
  { value: "advanced", label: "A/B", panelId: "mode-panel-advanced" },
  { value: "graph", label: "Graph", panelId: "mode-panel-graph" },
];

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
  const [gcsIngestionEffective, setGcsIngestionEffective] = useState(
    (process.env.NEXT_PUBLIC_GCS_INGESTION_ENABLED ?? "false").toLowerCase() === "true",
  );
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [indexed, setIndexed] = useState(false);
  const [filesChosen, setFilesChosen] = useState<File[]>([]);
  const [busy, setBusy] = useState<"idle" | "uploading" | "indexing" | "querying" | "comparing">(
    "idle",
  );
  const [mode, setMode] = useState<PlaygroundMode>(
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
  const [graphTrace, setGraphTrace] = useState<GraphRagTrace | null>(null);
  const [showGraphTrace, setShowGraphTrace] = useState(false);

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
      if (typeof health.gcs_ingestion_enabled === "boolean") {
        setGcsIngestionEffective(health.gcs_ingestion_enabled);
      }
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
  const { startTour } = useTour();
  useEffect(() => {
    if (shouldAutoStartWalkthrough()) {
      startTour("playground");
    }
  }, [startTour]);

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
    high: "badge-success",
    medium: "badge-warning",
    low: "badge-error",
  };
  const confidenceLabels: Record<ConfidenceLevel, string> = {
    high: "High",
    medium: "Medium",
    low: "Low",
  };

  const modeButtonClass = (value: AnswerMode) =>
    `btn btn-xs ${answerMode === value ? "btn-primary" : "btn-ghost"}`;

  const renderMarkdown = (value: string, fallback: string) =>
    value ? (
      <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm max-w-none">
        {value}
      </ReactMarkdown>
    ) : (
      <p className="text-base-content/60">{fallback}</p>
    );

  const canBuild =
    authSatisfied && !authGateActive && filesChosen.length > 0 && !!sessionId && !indexed && busy === "idle";
  const canQuery =
    authSatisfied && !authGateActive && indexed && query.trim().length > 0 && busy !== "querying";
  const canCompare =
    authSatisfied && !authGateActive && indexed && query.trim().length > 0 && busy !== "comparing";
  const isCheckingApi = apiStatus.state === "checking";
  const isGraphLoading = mode === "graph" && busy === "querying";
  const visibleModeTabs = MODE_TAB_CONFIG.filter(
    (tab) => tab.value !== "graph" || GRAPH_MODE_ENABLED,
  );

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

  function validateFileSizes(files: File[]): boolean {
    const oversized = files.filter((file) => file.size > UPLOAD_MAX_FILE_BYTES);
    if (!oversized.length) {
      return true;
    }
    const description = oversized
      .map((file) => `"${file.name}" (${formatBytesInMB(file.size)}MB)`)
      .join(", ");
    setError(
      `${description} exceed the current ${UPLOAD_MAX_FILE_MB}MB per-file limit. Please upload smaller files. ` +
        "100MB+ uploads are coming soon via direct-to-GCS support.",
    );
    return false;
  }

  function handleFilesSelected(files: File[]) {
    if (!validateFileSizes(files)) {
      setFilesChosen([]);
      setSessionId(null);
      setIndexed(false);
      setAnswer("");
      setConfidence(null);
      setSources([]);
      setQueryId(null);
      return;
    }
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
    if (!validateFileSizes(filesChosen)) {
      return;
    }
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
    setGraphTrace(null);
    setShowGraphTrace(false);
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
      setGraphTrace(response.trace ?? null);
      setShowGraphTrace(false);
    } catch (err: any) {
      setError(friendlyError(err));
      setGraphResult(null);
      setGraphTrace(null);
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
    } else if (!authEnabled) {
      void fetchHealthDetails()
        .then((details) => {
          setHealthDetails(details);
          if (typeof details.gcs_ingestion_enabled === "boolean") {
            setGcsIngestionEffective(details.gcs_ingestion_enabled);
          }
        })
        .catch(() => {
          /* no-op */
        });
    } else {
      setMetricsSummary(null);
      setHealthDetails(null);
      setAdminError(null);
    }
  }, [authEnabled, user?.is_admin, loadAdminData]);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-base-200">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 2xl:max-w-[1400px] py-8">
        <div className="grid grid-cols-12 gap-6">
      <section className="col-span-12 card card-soft-primary shadow-xl interactive-card">
        <div className="card-body space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Playground</p>
              <h1 className="card-title text-3xl text-base-content">RAG Playground</h1>
              <p className="text-sm text-base-content/70">
                Upload, configure, and compare Simple, A/B, and Graph RAG answers.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <MetricsDrawer />
              <HealthBadge />
              {authEnabled ? (
                user ? (
                  <div className="flex items-center gap-2 rounded-full border border-base-300 bg-base-200 px-3 py-1 text-xs">
                    <span className="font-semibold">{user.email}</span>
                    {user.is_admin ? <span className="badge badge-success badge-outline">Admin</span> : null}
                    <button
                      onClick={() => signOut()}
                      className="btn btn-ghost btn-xs interactive-button"
                      disabled={authLoading}
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => signIn()}
                    className="btn btn-primary btn-sm interactive-button"
                    disabled={authLoading}
                    data-tour-id="sign-in"
                  >
                    {authLoading ? "Loading…" : (
                      <span className="inline-flex items-center gap-2">
                        <GoogleIcon className="h-4 w-4" />
                        Sign in with Google
                      </span>
                    )}
                  </button>
                )
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="w-full overflow-x-auto">
              <div
                className="tabs tabs-boxed inline-flex text-sm"
                role="tablist"
                data-tour-id="mode-tabs"
                aria-label="Answer modes"
              >
                {visibleModeTabs.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    id={`mode-tab-${tab.value}`}
                    role="tab"
                    aria-selected={mode === tab.value}
                    aria-controls={tab.panelId}
                    className={`tab whitespace-nowrap interactive-tab ${mode === tab.value ? "tab-active" : ""}`}
                    onClick={() => setMode(tab.value)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-outline badge-sm">
                Ephemeral session · auto-cleans after 30m idle
              </span>
              <span className="badge badge-outline badge-sm">Client ID prefix: {clientIdPrefix}</span>
            </div>
          </div>
        </div>
      </section>
      <section className="col-span-12 space-y-4">
        <div className="card card-soft-secondary shadow interactive-card">
          <div className="card-body space-y-4 text-sm text-base-content">
            <div className="flex items-center justify-between">
              <h3 className="card-title text-base text-base-content">Documents & session</h3>
              {busy !== "idle" ? <LoadingBadge label={busy === "uploading" ? "Uploading" : "Busy"} /> : null}
            </div>
            <Uploader
              disabled={busy !== "idle" || authGateActive}
              onFilesSelected={handleFilesSelected}
              onUseSamples={useSamples}
            />
            <UploadLimitHint />
            <div className="text-xs text-base-content/60">Uploads start immediately after selection.</div>
            <div className="rounded-box border border-dashed border-base-300 bg-base-200/60 p-3 text-sm">
              {filesChosen.length ? (
                <ul className="space-y-1">
                  {filesChosen.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="truncate">
                      • {file.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-base-content/60">No files selected.</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-base-content/70">
              <span className="badge badge-outline">
                Session: {sessionId ? `${sessionId.slice(0, 8)}…` : "—"}
              </span>
              <span className={`badge ${indexed ? "badge-success" : "badge-ghost"}`}>
                Indexed: {indexed ? "yes" : "no"}
              </span>
            </div>
            <button
              onClick={doIndex}
              disabled={!canBuild}
              className="btn btn-primary btn-sm w-full interactive-button"
              data-tour-id="build-index"
            >
              {busy === "indexing" ? "Indexing…" : "Build index"}
            </button>
          </div>
        </div>
      </section>
      <section className="col-span-12 space-y-4">
        <div className="card card-soft-accent shadow interactive-card">
          <div className="card-body space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="card-title text-base text-base-content">Ask a question</h2>
                {mode !== "graph" ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/70">
                    <span className="font-semibold text-base-content">Answer mode</span>
                    <div className="join">
                      <button
                        type="button"
                        className={`${modeButtonClass("grounded")} join-item`}
                        onClick={() => setAnswerMode("grounded")}
                      >
                        Document-only
                      </button>
                      <button
                        type="button"
                        className={`${modeButtonClass("blended")} join-item`}
                        onClick={() => setAnswerMode("blended")}
                      >
                        Doc + world context
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-3 md:flex-row">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="e.g., What is our PTO policy?"
                className="input input-bordered w-full bg-base-100"
                data-tour-id="query-input"
              />
                <div className="flex flex-shrink-0 gap-2">
                {mode === "simple" ? (
                  <button
                    type="button"
                    onClick={doQuerySimple}
                    className="btn btn-primary interactive-button"
                    disabled={!canQuery}
                    data-tour-id="run-button"
                  >
                    {busy === "querying" ? <LoadingBadge label="Running" /> : "Run"}
                  </button>
                ) : null}
                {mode === "advanced" ? (
                  <button
                    type="button"
                    onClick={doCompare}
                    className="btn btn-primary interactive-button"
                    disabled={!canCompare}
                    data-tour-id="run-button"
                  >
                    {busy === "comparing" ? <LoadingBadge label="Comparing" /> : "Run A/B"}
                  </button>
                ) : null}
                {mode === "graph" ? (
                  <button
                    type="button"
                    onClick={() => {
                      void runGraphQuery();
                    }}
                    className="btn btn-primary interactive-button"
                    disabled={
                      !authSatisfied || authGateActive || !indexed || !query.trim() || busy === "querying"
                    }
                    data-tour-id="run-button"
                  >
                    {busy === "querying" ? <LoadingBadge label="Graph RAG" /> : "Run Graph RAG"}
                  </button>
                ) : null}
                </div>
              </div>
              {mode === "graph" ? (
                <div
                  className="rounded-box border border-dashed border-base-300 bg-base-100/80 p-4 text-xs text-base-content/80 md:grid md:grid-cols-2 md:gap-4"
                  data-tour-id="graph-settings"
                >
                  <div className="space-y-1">
                    <label className="font-semibold">Top-k passages</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={graphSettings.k}
                      onChange={(event) =>
                        setGraphSettings((prev) => ({ ...prev, k: Number(event.target.value) || 1 }))
                      }
                      className="input input-bordered input-sm w-full bg-base-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold">Max graph hops</label>
                    <input
                      type="number"
                      min={1}
                      max={4}
                      value={graphSettings.maxHops}
                      onChange={(event) =>
                        setGraphSettings((prev) => ({ ...prev, maxHops: Number(event.target.value) || 1 }))
                      }
                      className="input input-bordered input-sm w-full bg-base-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold">Temperature</label>
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      max={1}
                      value={graphSettings.temperature}
                      onChange={(event) =>
                        setGraphSettings((prev) => ({ ...prev, temperature: Number(event.target.value) || 0 }))
                      }
                      className="input input-bordered input-sm w-full bg-base-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold">Rerank strategy</label>
                    <select
                      value={graphSettings.rerank}
                      onChange={(event) =>
                        setGraphSettings((prev) => ({ ...prev, rerank: event.target.value as "ce" | "llm" }))
                      }
                      className="select select-bordered select-sm w-full bg-base-100"
                    >
                      <option value="ce">Cross-encoder</option>
                      <option value="llm" disabled={!LLM_RERANK_ALLOWED}>
                        LLM rerank {LLM_RERANK_ALLOWED ? "" : "(disabled)"}
                      </option>
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="font-semibold">Verification</label>
                    <select
                      value={graphSettings.verificationMode}
                      onChange={(event) =>
                        setGraphSettings((prev) => ({
                          ...prev,
                          verificationMode: event.target.value as "none" | "ragv" | "llm",
                        }))
                      }
                      className="select select-bordered select-sm w-full bg-base-100"
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
              {mode !== "graph" ? (
                <p className="text-xs text-base-content/60">World notes appear only in Doc + world context.</p>
              ) : null}
            </div>
            <div className="divider" />
            <div className="space-y-6">

        {mode === "graph" ? (
          <div
            id="mode-panel-graph"
            role="tabpanel"
            aria-labelledby="mode-tab-graph"
            className="space-y-4"
          >
            <div className="card card-soft-neutral shadow interactive-card">
              <div className="card-body space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="card-title text-base text-base-content">Graph RAG answer</h3>
                  {graphResult?.verification ? (
                    <span className="badge badge-outline badge-info">
                      Verification: {graphResult.verification.verdict}
                    </span>
                  ) : null}
                </div>
                <div className="prose prose-sm max-h-[60vh] min-h-[200px] overflow-auto rounded-box border border-base-300 bg-base-100 p-4">
                  {graphResult
                    ? renderMarkdown(graphResult.answer, "Graph RAG answer will appear here.")
                    : isGraphLoading
                      ? <SkeletonBlock lines={5} />
                      : "Graph RAG answer will appear here."}
                </div>
                {graphResult?.verification ? (
                  <div className="rounded-box border border-base-300 bg-base-200/60 p-3 text-xs text-base-content/80">
                    <div className="text-xs font-semibold uppercase text-base-content/60">Verification</div>
                    <div className="text-base-content">Mode: {graphResult.verification.mode}</div>
                    <div>Coverage: {(graphResult.verification.coverage * 100).toFixed(0)}%</div>
                    <div className="text-base-content/70">{graphResult.verification.notes}</div>
                  </div>
                ) : null}
              </div>
            </div>
            {graphResult ? (
              <div className="card card-soft-neutral shadow interactive-card">
                <div className="card-body space-y-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="card-title text-base text-base-content">Diagnostics</h3>
                    <button
                      type="button"
                      onClick={() => setShowGraphTrace((prev) => !prev)}
                      disabled={!graphTrace}
                      className="btn btn-accent btn-xs interactive-button"
                      data-tour-id="graph-show-trace"
                    >
                      {showGraphTrace ? "Hide trace" : "Show trace"}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {graphResult.subqueries.map((sub) => (
                      <div key={sub.query} className="rounded-box border border-base-200 bg-base-200/60 p-3">
                        <div className="text-sm font-semibold text-base-content">{sub.query}</div>
                        <div className="text-base-content/70">{sub.answer}</div>
                        <div className="text-[11px] text-base-content/60">
                          Hops: {sub.metrics.hops_used ?? "-"} · Graph hits: {sub.metrics.graph_candidates ?? "-"} · Hybrid hits: {sub.metrics.hybrid_candidates ?? "-"}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-box border border-base-200 bg-base-200/40 p-3 text-xs text-base-content/70">
                    {graphTrace ? (
                      <span>Trace ID: {graphTrace.request_id.slice(0, 8)}…</span>
                    ) : (
                      <span>Trace unavailable for this run.</span>
                    )}
                  </div>
                  {showGraphTrace && graphTrace ? (
                    <div className="rounded-box border border-base-200 bg-base-100 p-3">
                      <GraphRagTraceViewer trace={graphTrace} />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : isGraphLoading ? (
              <div className="card card-soft-neutral shadow interactive-card">
                <div className="card-body">
                  <SkeletonBlock lines={4} />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === "simple" ? (
          <div id="mode-panel-simple" role="tabpanel" aria-labelledby="mode-tab-simple">
            <div className="card card-soft-neutral shadow interactive-card">
              <div className="card-body space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="card-title text-base text-base-content">Answer</h3>
                  {confidence ? (
                    <span className={`badge badge-outline ${confidenceStyles[confidence]}`}>
                      Confidence: {confidenceLabels[confidence]}
                    </span>
                  ) : null}
                </div>
                <div className="prose prose-sm max-h-[60vh] min-h-[200px] overflow-auto rounded-box border border-base-300 bg-base-100 p-4">
                  {renderMarkdown(answer, "Answer stream will appear here.")}
                </div>
                <div className="flex flex-wrap justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => copyMarkdown(answer)}
                    disabled={!answer}
                    className="btn btn-ghost btn-xs"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadMarkdown(answer, "answer.md")}
                    disabled={!answerComplete || !answer}
                    className="btn btn-ghost btn-xs"
                  >
                    Download .md
                  </button>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-base-content/60">Sources</div>
                  <div className="rounded-box border border-base-300 bg-base-200/60 p-3">
                    {sources.length ? (
                      <ul className="space-y-2 text-sm">
                        {sources.map((source) => (
                          <li key={source.rank}>
                            <div className="font-semibold">[{source.rank}] doc {source.doc_id.slice(0, 8)}…</div>
                            <div className="text-base-content/70 line-clamp-4">{source.text}</div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-base-content/60">Retrieved chunks will show here.</p>
                    )}
                  </div>
                </div>
                <div data-tour-id="feedback-bar">
                  <FeedbackBar queryId={queryId} />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {mode === "advanced" ? (
          <div id="mode-panel-advanced" role="tabpanel" aria-labelledby="mode-tab-advanced">
            <div className="card card-soft-neutral shadow interactive-card">
              <div className="card-body space-y-4">
                <h3 className="card-title text-base text-base-content">A/B answers</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { label: "Answer — Profile A", value: answerA, complete: answerAComplete, sources: retrievedA, fileName: "answer-profile-a.md" },
                    { label: "Answer — Profile B", value: answerB, complete: answerBComplete, sources: retrievedB, fileName: "answer-profile-b.md" },
                  ].map((item) => (
                    <div key={item.label} className="space-y-3 rounded-box border border-base-300 bg-base-100 p-3">
                      <div className="text-sm font-semibold">{item.label}</div>
                      <div className="prose prose-sm max-h-[60vh] min-h-[160px] overflow-auto rounded-box border border-base-200 bg-base-100 p-3">
                        {renderMarkdown(item.value, `${item.label} stream will appear here.`)}
                      </div>
                      <div className="flex justify-end gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => copyMarkdown(item.value)}
                          disabled={!item.value}
                          className="btn btn-ghost btn-xs"
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadMarkdown(item.value, item.fileName)}
                          disabled={!item.complete || !item.value}
                          className="btn btn-ghost btn-xs"
                        >
                          Download .md
                        </button>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase text-base-content/60">Sources</div>
                        <div className="rounded-box border border-base-200 bg-base-200/60 p-2">
                          {item.sources.length ? (
                            <ul className="space-y-2 text-sm">
                              {item.sources.map((source) => (
                                <li key={`${item.label}-${source.rank}`}>
                                  <div className="font-semibold">[{source.rank}] doc {source.doc_id.slice(0, 8)}…</div>
                                  <div className="text-base-content/70 line-clamp-4">{source.text}</div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-base-content/60">—</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="alert alert-error">{error}</div>
        ) : null}
            </div>
          </div>
        </div>
      </section>

        {mode === "advanced" ? (
          <section className="col-span-12 card card-soft-secondary shadow interactive-card">
            <div className="card-body space-y-3">
              <h3 className="card-title text-base text-base-content">Profiles (A/B)</h3>
              <AdvancedSettings
                valueA={profileA}
                valueB={profileB}
                onChange={(which, next) => (which === "A" ? setProfileA(next) : setProfileB(next))}
              />
            </div>
          </section>
        ) : null}

        <section className="col-span-12 card card-soft-neutral shadow interactive-card">
          <div className="card-body space-y-4 text-sm text-base-content">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="card-title text-base text-base-content">API status</h2>
              <p className="text-xs text-base-content/70">
                Using NEXT_PUBLIC_API_BASE_URL for all requests.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void checkApiStatus();
              }}
              className="btn btn-ghost btn-xs"
              disabled={apiStatus.state === "checking"}
            >
              {apiStatus.state === "checking" ? <LoadingBadge label="Checking" /> : "Refresh"}
            </button>
          </div>
          <dl className="grid grid-cols-1 gap-3 text-xs text-base-content/80 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-box bg-base-200/60 p-3">
              <dt className="text-xs font-semibold uppercase text-base-content/60">Base URL</dt>
              <dd className="break-words text-base-content">
                {isCheckingApi ? <SkeletonLine className="h-4 w-40" /> : apiBaseUrl}
              </dd>
            </div>
            <div className="rounded-box bg-base-200/60 p-3">
              <dt className="text-xs font-semibold uppercase text-base-content/60">Storage backend</dt>
              <dd>
                {isCheckingApi ? (
                  <SkeletonLine className="h-4 w-24" />
                ) : gcsIngestionEffective ? (
                  "Cloud-backed (GCS)"
                ) : (
                  "In-memory"
                )}
              </dd>
            </div>
            <div className="rounded-box bg-base-200/60 p-3">
              <dt className="text-xs font-semibold uppercase text-base-content/60">Connectivity</dt>
              <dd
                className={
                  isCheckingApi
                    ? "text-base-content/60"
                    : apiStatus.state === "ok"
                    ? "text-success"
                    : apiStatus.state === "error"
                      ? "text-error"
                      : "text-base-content/60"
                }
              >
                {isCheckingApi
                  ? <SkeletonLine className="h-4 w-24" />
                  : apiStatus.state === "ok"
                    ? apiStatus.detail
                    : apiStatus.state === "error"
                      ? `unreachable — ${apiStatus.detail}`
                      : ""}
              </dd>
            </div>
            <div className="rounded-box bg-base-200/60 p-3">
              <dt className="text-xs font-semibold uppercase text-base-content/60">Client ID prefix</dt>
              <dd>{isCheckingApi ? <SkeletonLine className="h-4 w-16" /> : clientIdPrefix}</dd>
            </div>
          </dl>
          {apiStatus.state === "error" ? (
            <div className="alert alert-error text-xs">
              API check failed: {apiStatus.detail}
            </div>
          ) : null}

        </div>
      </section>
      {authEnabled ? (
        <section className="col-span-12 card card-soft-neutral shadow interactive-card">
          <div className="card-body space-y-3 text-sm text-base-content">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="card-title text-base text-base-content">Auth diagnostics</h2>
                <p className="text-xs text-base-content/70">Client-side session information</p>
              </div>
              <button
                type="button"
                onClick={handleRefreshSession}
                className="btn btn-outline btn-xs"
                disabled={refreshingSession}
              >
                {refreshingSession ? "Refreshing…" : "Refresh session"}
              </button>
            </div>
            <dl className="grid grid-cols-1 gap-3 text-xs text-base-content/80 sm:grid-cols-2 md:grid-cols-3">
              <div>
                <dt className="font-semibold text-base-content/70">Auth enabled</dt>
                <dd>{String(authEnabled)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-base-content/70">Client ID prefix</dt>
                <dd>{clientIdPrefix}</dd>
              </div>
              <div>
                <dt className="font-semibold text-base-content/70">Authenticated</dt>
                <dd>{String(!!user)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-base-content/70">Email</dt>
                <dd>{user?.email ?? "-"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-base-content/70">Is admin</dt>
                <dd>{String(user?.is_admin ?? false)}</dd>
              </div>
            </dl>
            {authError ? (
              <p className="text-xs text-error">Authentication error: {authError}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {authEnabled && user?.is_admin ? (
        <section className="col-span-12 card card-soft-neutral shadow interactive-card">
          <div className="card-body space-y-4 text-sm text-base-content">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="card-title text-base text-base-content">Admin tools</h2>
              <button
                type="button"
                onClick={handleAdminRefresh}
                className="btn btn-ghost btn-xs"
                disabled={adminLoading}
              >
                {adminLoading ? <LoadingBadge label="Refreshing" /> : "Refresh data"}
              </button>
            </div>
            {adminError ? <p className="text-xs text-error">{adminError}</p> : null}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-box bg-base-200/70 p-3 text-xs">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
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
                      <p className="font-semibold text-base-content/70">Queries by mode</p>
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
                      <p className="font-semibold text-base-content/70">Queries by confidence</p>
                      <ul className="mt-1 space-y-1 text-[11px]">
                        {Object.entries(metricsSummary.queries_by_confidence).map(([level, count]) => (
                          <li key={level} className="flex justify-between">
                            <span>{level}</span>
                            <span className="font-semibold">{count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-[11px] text-base-content/60">
                      <div>Last query: {metricsSummary.last_query_ts ?? "-"}</div>
                      <div>Last error: {metricsSummary.last_error_ts ?? "-"}</div>
                      <div>Rerank: {metricsSummary.rerank_strategy_current}</div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-base-content/60">Metrics will appear after activity.</p>
                )}
              </div>
              <div className="rounded-box bg-base-200/70 p-3 text-xs">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
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
                  <p className="mt-2 text-xs text-base-content/60">Health details unavailable.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}





      {mode === "simple" ? (
        <aside className="col-span-12 space-y-4 lg:col-span-3">
          <div className="card card-soft-neutral shadow interactive-card">
            <div className="card-body space-y-3 text-sm text-base-content">
              <div className="flex items-center justify-between">
                <h3 className="card-title text-base text-base-content">Explainability</h3>
                <span className="badge badge-outline badge-sm">Simple mode</span>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-base-content/60">Sources</div>
                <div className="rounded-box border border-base-300 bg-base-200/60 p-2">
                  {sources.length ? (
                    <ul className="space-y-2">
                      {sources.map((source) => (
                        <li key={source.rank} className="text-sm">
                          <div className="font-semibold">[{source.rank}] doc {source.doc_id.slice(0, 8)}…</div>
                          <div className="text-base-content/70 line-clamp-4">{source.text}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-base-content/60">Retrieved chunks will show here.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </aside>
      ) : null}
        </div>
      </div>
    </main>
  );
}
