"use client";

import React, { useCallback } from "react";

import type { GraphRagTrace } from "../lib/types";

function formatHop(step: { hop: number; subquery: string }) {
  return `Hop ${step.hop + 1}: ${step.subquery}`;
}

type Props = {
  trace: GraphRagTrace;
};

export default function GraphRagTraceViewer({ trace }: Props) {
  const handleDownload = useCallback(() => {
    const blob = new Blob([JSON.stringify(trace, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `graph-trace-${trace.request_id}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [trace]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Trace</div>
          <div className="text-base font-semibold text-slate-900">{trace.mode}</div>
          <div className="text-[11px] text-slate-500">Request {trace.request_id}</div>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Download JSON
        </button>
      </div>

      {trace.warnings.length ? (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          <div className="font-semibold">Warnings</div>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {trace.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="mt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Planner</div>
        {trace.planner_steps.length ? (
          <ol className="mt-2 space-y-2">
            {trace.planner_steps.map((step) => (
              <li key={`${step.hop}-${step.subquery}`} className="rounded border border-slate-100 bg-slate-50 p-2">
                <div className="text-xs font-semibold text-slate-600">{formatHop(step)}</div>
                {step.notes ? <div className="text-xs text-slate-500">{step.notes}</div> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-slate-500">No planner steps recorded.</p>
        )}
      </section>

      <section className="mt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Retrieval hits</div>
        {trace.retrieval_hits.length ? (
          <ul className="mt-2 space-y-2">
            {trace.retrieval_hits.map((hit, idx) => (
              <li key={`${hit.doc_id ?? "doc"}-${idx}`} className="rounded border border-slate-100 bg-slate-50 p-2">
                <div className="text-xs text-slate-500">
                  Rank {hit.rank ?? idx + 1} · {hit.source ?? hit.doc_id ?? "unknown source"}
                </div>
                {hit.score !== undefined && hit.score !== null ? (
                  <div className="text-[11px] text-slate-400">Score {hit.score.toFixed(3)}</div>
                ) : null}
                {hit.snippet ? <div className="text-sm text-slate-900">{hit.snippet}</div> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500">Retrieval did not return usable context.</p>
        )}
      </section>

      <section className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded border border-slate-100 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verification</div>
          {trace.verification ? (
            <div className="mt-2 text-sm text-slate-900">
              <div className="font-semibold capitalize">{trace.verification.verdict}</div>
              {trace.verification.reason ? (
                <div className="text-xs text-slate-600">{trace.verification.reason}</div>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No verification performed.</p>
          )}
        </div>
        <div className="rounded border border-slate-100 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Synthesis notes</div>
          {trace.synthesis_notes.length ? (
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {trace.synthesis_notes.map((note) => (
                <li key={`${note.step}-${note.notes ?? ""}`}>
                  <span className="font-semibold">{note.step}:</span> {note.notes ?? "No details."}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">No synthesis notes recorded.</p>
          )}
        </div>
      </section>
    </div>
  );
}
