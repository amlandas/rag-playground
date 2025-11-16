"use client";

import React, { useCallback, useMemo } from "react";

import type { GraphRagTrace } from "../lib/types";

type GraphRagTraceViewerProps = {
  trace: GraphRagTrace;
};

function formatTimestamp(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function GraphRagTraceViewer({ trace }: GraphRagTraceViewerProps) {
  const formattedTs = useMemo(() => formatTimestamp(trace.timestamp), [trace.timestamp]);
  const configItems = useMemo(
    () => [
      { label: "k", value: trace.config.k },
      { label: "Max hops", value: trace.config.max_hops },
      { label: "Max sub-queries", value: trace.config.max_subqueries },
      { label: "Temperature", value: trace.config.temperature },
      { label: "Rerank", value: trace.config.rerank_strategy.toUpperCase() },
      { label: "Verification", value: trace.config.verification_mode.toUpperCase() },
      { label: "Model", value: trace.config.model },
    ],
    [trace.config],
  );

  const handleDownload = useCallback(() => {
    const blob = new Blob([JSON.stringify(trace, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `graph-trace-${trace.request_id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [trace]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Graph RAG Trace</h3>
          <p className="text-xs text-slate-500">Captured {formattedTs}</p>
          <p className="text-xs text-slate-500">Request {trace.request_id.slice(0, 8)}…</p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Download JSON
        </button>
      </div>

      {trace.warnings.length ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          <div className="font-semibold">Warnings</div>
          <ul className="list-disc pl-4">
            {trace.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <dl className="mt-4 grid gap-3 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="font-semibold text-slate-700">Query</dt>
          <dd className="text-slate-900">{trace.query}</dd>
        </div>
        {configItems.map((item) => (
          <div key={item.label}>
            <dt className="font-semibold text-slate-700">{item.label}</dt>
            <dd className="text-slate-900">{item.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Planner</h4>
        <ol className="mt-2 space-y-2">
          {trace.planner.sub_queries.map((sub) => (
            <li key={sub.id} className="rounded border border-slate-200 bg-slate-50 p-2">
              <div className="text-xs font-semibold text-slate-600">
                Step {sub.id} · {sub.stage}
              </div>
              <div className="text-sm text-slate-900">{sub.text}</div>
              {sub.tags?.length ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {sub.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-5 space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pipeline</h4>
        {trace.subqueries.map((sub) => (
          <div key={sub.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Sub-query {sub.id}: {sub.query}
                </div>
                <p className="text-xs text-slate-500">
                  Graph paths: {sub.retrieval.graph_paths.length} · Documents: {sub.retrieval.documents.length}
                </p>
              </div>
              {sub.warnings.length ? (
                <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
                  {sub.warnings.join(" · ")}
                </span>
              ) : null}
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <div className="rounded border border-white bg-white/80 p-2 text-xs text-slate-600 shadow">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Retrieval</div>
                <ul className="mt-2 space-y-1">
                  {sub.retrieval.documents.length ? (
                    sub.retrieval.documents.map((doc) => (
                      <li key={`${sub.id}-${doc.chunk_index}-${doc.rank}`}>
                        <div className="text-[11px] text-slate-500">
                          [{doc.rank}] {doc.doc_id.slice(0, 8)}… · chunk #{doc.chunk_index}
                        </div>
                        <div className="text-sm text-slate-900 line-clamp-3">{doc.snippet}</div>
                        <div className="text-[11px] text-slate-400">
                          dense={doc.dense_score?.toFixed(2) ?? "-"} · lexical={doc.lexical_score?.toFixed(2) ?? "-"} ·
                          rerank={doc.rerank_score?.toFixed(2) ?? "-"}
                        </div>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-400">No documents returned.</li>
                  )}
                </ul>
                <div className="mt-2 text-[11px] text-slate-400">
                  Hops {sub.retrieval.metrics.hops_used ?? "-"} · Graph hits {sub.retrieval.metrics.graph_candidates ?? "-"} ·
                  Hybrid hits {sub.retrieval.metrics.hybrid_candidates ?? "-"}
                </div>
              </div>
              <div className="rounded border border-white bg-white/80 p-2 text-xs text-slate-600 shadow">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rerank</div>
                {sub.rerank ? (
                  <>
                    <p className="text-sm text-slate-900">
                      Strategy {sub.rerank.strategy.toUpperCase()} · {sub.rerank.latency_ms.toFixed(1)} ms
                    </p>
                    <ul className="mt-2 space-y-1">
                      {sub.rerank.top_documents.map((doc) => (
                        <li key={`${sub.id}-rerank-${doc.chunk_index}-${doc.rank}`} className="text-[11px] text-slate-500">
                          {doc.doc_id.slice(0, 8)}… score {doc.rerank_score?.toFixed(2) ?? "-"}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">No rerank scores for this sub-query.</p>
                )}
              </div>
              <div className="rounded border border-white bg-white/80 p-2 text-xs text-slate-600 shadow">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Summary</div>
                <p className="text-sm text-slate-900 whitespace-pre-line">{sub.summary.text}</p>
                <div className="mt-2 text-[11px] text-slate-500">
                  Citations: {sub.summary.citations.length ? sub.summary.citations.join(", ") : "None"}
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-5 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verification</div>
          {trace.verification ? (
            <div className="mt-2 text-sm text-slate-900">
              <div className="font-semibold text-purple-700">{trace.verification.verdict.toUpperCase()}</div>
              <div className="text-xs text-slate-600">
                Mode {trace.verification.mode.toUpperCase()} · Coverage {(trace.verification.coverage * 100).toFixed(0)}%
              </div>
              <p className="mt-1 text-sm text-slate-800">{trace.verification.notes}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Verification disabled for this run.</p>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Synthesis</div>
          <p className="text-sm text-slate-900 whitespace-pre-line">{trace.synthesis.answer}</p>
          <div className="mt-2 text-[11px] text-slate-500">
            Model {trace.synthesis.model} · Citations {trace.synthesis.citations.length}
          </div>
        </div>
      </section>
    </div>
  );
}
