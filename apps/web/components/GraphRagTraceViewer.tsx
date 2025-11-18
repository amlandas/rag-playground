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
    <div className="space-y-4 text-sm text-base-content">
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-base-content/60">Trace</div>
              <div className="text-base font-semibold text-base-content">{trace.mode}</div>
              <div className="text-[11px] text-base-content/60">Request {trace.request_id}</div>
            </div>
            <button type="button" onClick={handleDownload} className="btn btn-outline btn-xs">
              Download JSON
            </button>
          </div>
        </div>
      </div>

      {trace.warnings.length ? (
        <div className="alert alert-warning text-xs">
          <div className="font-semibold">Warnings</div>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {trace.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="rounded-box border border-base-200 bg-base-200/60 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Planner</div>
        {trace.planner_steps.length ? (
          <ol className="mt-2 space-y-2">
            {trace.planner_steps.map((step) => (
              <li key={`${step.hop}-${step.subquery}`} className="rounded-box border border-base-200 bg-base-100 p-2">
                <div className="text-xs font-semibold text-base-content/80">{formatHop(step)}</div>
                {step.notes ? <div className="text-xs text-base-content/60">{step.notes}</div> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-base-content/60">No planner steps recorded.</p>
        )}
      </section>

      <section className="rounded-box border border-base-200 bg-base-200/60 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Retrieval hits</div>
        {trace.retrieval_hits.length ? (
          <ul className="mt-2 space-y-2">
            {trace.retrieval_hits.map((hit, idx) => (
              <li key={`${hit.doc_id ?? "doc"}-${idx}`} className="rounded-box border border-base-200 bg-base-100 p-2">
                <div className="text-xs text-base-content/60">
                  Rank {hit.rank ?? idx + 1} · {hit.source ?? hit.doc_id ?? "unknown source"}
                </div>
                {hit.score !== undefined && hit.score !== null ? (
                  <div className="text-[11px] text-base-content/50">Score {hit.score.toFixed(3)}</div>
                ) : null}
                {hit.snippet ? <div className="text-sm text-base-content">{hit.snippet}</div> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-base-content/60">Retrieval did not return usable context.</p>
        )}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-box border border-base-200 bg-base-200/60 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Verification</div>
          {trace.verification ? (
            <div className="mt-2 text-sm text-base-content">
              <div className="font-semibold capitalize">{trace.verification.verdict}</div>
              {trace.verification.reason ? (
                <div className="text-xs text-base-content/70">{trace.verification.reason}</div>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-base-content/60">No verification performed.</p>
          )}
        </div>
        <div className="rounded-box border border-base-200 bg-base-200/60 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Synthesis notes</div>
          {trace.synthesis_notes.length ? (
            <ul className="mt-2 space-y-1 text-xs text-base-content/80">
              {trace.synthesis_notes.map((note) => (
                <li key={`${note.step}-${note.notes ?? ""}`}>
                  <span className="font-semibold">{note.step}:</span> {note.notes ?? "No details."}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-base-content/60">No synthesis notes recorded.</p>
          )}
        </div>
      </section>
    </div>
  );
}
