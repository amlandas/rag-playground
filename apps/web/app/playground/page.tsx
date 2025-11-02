"use client";

import { useEffect, useState } from "react";
import AdvancedSettings from "../../components/AdvancedSettings";
import FeedbackBar from "../../components/FeedbackBar";
import HealthBadge from "../../components/HealthBadge";
import MetricsDrawer from "../../components/MetricsDrawer";
import Uploader from "../../components/Uploader";
import {
  answerFromSnippetsSSE,
  buildIndex,
  compareRetrieval,
  querySSE,
  uploadFiles,
} from "../../lib/rag-api";
import type { CompareProfile, RetrievedChunk, RetrievedPrelude } from "../../lib/types";

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
  if (message.includes("429") || lower.includes("rate limit") || lower.includes("query cap")) {
    return "Session query limit reached. Please start a new session.";
  }
  return message || "Something went wrong.";
}

export default function Playground() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [indexed, setIndexed] = useState(false);
  const [filesChosen, setFilesChosen] = useState<File[]>([]);
  const [busy, setBusy] = useState<"idle" | "uploading" | "indexing" | "querying" | "comparing">(
    "idle",
  );
  const [mode, setMode] = useState<"simple" | "advanced">("simple");

  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
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
const [queryId, setQueryId] = useState<string | null>(null);

  const canBuild = filesChosen.length > 0 && !!sessionId && !indexed && busy === "idle";
  const canQuery = indexed && query.trim().length > 0 && busy !== "querying";
  const canCompare = indexed && query.trim().length > 0 && busy !== "comparing";

  async function useSamples() {
    const files = await fetchSampleFiles();
    setFilesChosen(files);
    setSessionId(null);
    setIndexed(false);
    setAnswer("");
    setSources([]);
    setError(null);
    setQueryId(null);
  }

  function handleFilesSelected(files: File[]) {
    setFilesChosen(files);
    setSessionId(null);
    setIndexed(false);
    setAnswer("");
    setSources([]);
    setError(null);
    setQueryId(null);
  }

  async function doUpload() {
    if (!filesChosen.length) return;
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
    setBusy("querying");
    setAnswer("");
    setSources([]);
    setError(null);
     setQueryId(null);
    await querySSE(
      sessionId,
      { query, k: 4, similarity: "cosine", temperature: 0.2, model: "gpt-4o-mini" },
      {
        onRetrieved: (payload: RetrievedPrelude & { query_id?: string }) => {
          if (payload.query_id) {
            setQueryId(payload.query_id);
          }
          setSources(payload.retrieved || []);
        },
        onToken: (token) => {
          setAnswer((prev) => prev + token);
        },
        onDone: () => setBusy("idle"),
        onError: (err) => {
          setError(friendlyError(err));
          setBusy("idle");
        },
      },
    );
  }

  async function doCompare() {
    if (!sessionId) return;
    setBusy("comparing");
    setError(null);
    setRetrievedA([]);
    setRetrievedB([]);
    setAnswerA("");
    setAnswerB("");
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
            /* proceed to B */
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
          onDone: () => setBusy("idle"),
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
    if (filesChosen.length > 0) {
      void doUpload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesChosen]);

  useEffect(() => {
    if (mode !== "simple") {
      setQueryId(null);
    }
  }, [mode]);

  return (
    <main className="grid min-h-screen grid-cols-12 gap-4 px-4 py-4">
      <div className="col-span-12 flex items-center justify-between">
        <div className="text-lg font-semibold">RAG Playground</div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Mode:</span>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as "simple" | "advanced")}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="simple">Simple</option>
            <option value="advanced">Advanced (A/B)</option>
          </select>
          <span className="text-xs rounded-full border px-2 py-0.5 text-gray-600">
            Ephemeral • auto-cleans after 30m idle
          </span>
          <MetricsDrawer />
          <HealthBadge />
        </div>
      </div>

      <aside className="col-span-3 space-y-4 rounded-xl border p-3">
        <div>
          <div className="mb-2 text-sm font-semibold">Files</div>
          <Uploader
            disabled={busy !== "idle"}
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
              {busy === "indexing" ? "Indexing…" : "Build index"}
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
        className={`rounded-xl border p-3 ${mode === "advanced" ? "col-span-9" : "col-span-6"}`}
      >
        <div className="mb-2 text-sm font-semibold">Ask a question</div>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g., What is our PTO policy?"
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring"
          />
          {mode === "simple" ? (
            <button
              onClick={doQuerySimple}
              className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
              disabled={!canQuery}
            >
              {busy === "querying" ? "Running…" : "Run"}
            </button>
          ) : (
            <button
              onClick={doCompare}
              className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
              disabled={!canCompare}
            >
              {busy === "comparing" ? "Comparing…" : "Run A/B"}
            </button>
          )}
        </div>

        {mode === "simple" ? (
          <div className="mt-4">
            <div className="mb-2 text-sm font-semibold">Answer</div>
            <div className="min-h-[200px] whitespace-pre-wrap rounded-lg border p-3 text-sm text-gray-800">
              {answer || "Answer stream will appear here."}
            </div>
            <div className="mt-2">
              <FeedbackBar queryId={queryId} />
            </div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 text-sm font-semibold">Answer — Profile A</div>
              <div className="min-h-[160px] whitespace-pre-wrap rounded-lg border p-3 text-sm text-gray-800">
                {answerA || "Answer A stream will appear here."}
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
              <div className="min-h-[160px] whitespace-pre-wrap rounded-lg border p-3 text-sm text-gray-800">
                {answerB || "Answer B stream will appear here."}
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
        )}

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
