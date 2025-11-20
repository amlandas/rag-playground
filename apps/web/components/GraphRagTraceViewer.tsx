"use client";

import React, { useCallback } from "react";

import type { GraphRagTrace } from "../lib/types";

function formatHop(step: { hop: number; subquery: string }) {
  return `Hop ${step.hop + 1}: ${step.subquery}`;
}

const verdictClass = (verdict?: string) => {
  if (!verdict) return "badge-ghost";
  if (verdict.toLowerCase().includes("fail") || verdict.toLowerCase().includes("warn")) {
    return "badge-error";
  }
  return "badge-success";
};

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
      <div className="card bg-base-100 shadow interactive-card">
        <div className="card-body flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Trace</p>
            <h3 className="card-title text-base">{trace.mode}</h3>
            <div className="text-[11px] text-base-content/60">Request {trace.request_id}</div>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="btn btn-ghost btn-outline btn-xs interactive-button"
          >
            Download JSON
          </button>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="collapse collapse-arrow bg-base-100 shadow-sm transition-all duration-200">
          <input type="checkbox" defaultChecked />
          <div className="collapse-title text-sm font-semibold">Planner steps</div>
          <div className="collapse-content space-y-2">
            {trace.planner_steps.length ? (
              trace.planner_steps.map((step) => (
                <div key={`${step.hop}-${step.subquery}`} className="rounded-box border border-base-200 bg-base-200/60 p-3">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>{formatHop(step)}</span>
                    <span className="badge badge-primary badge-outline whitespace-nowrap px-3 py-1 text-xs font-semibold">
                      Hop {step.hop + 1}
                    </span>
                  </div>
                  {step.notes ? <div className="text-xs text-base-content/70">{step.notes}</div> : null}
                </div>
              ))
            ) : (
              <p className="text-xs text-base-content/60">No planner steps recorded.</p>
            )}
          </div>
        </div>

        <div className="collapse collapse-arrow bg-base-100 shadow-sm transition-all duration-200">
          <input type="checkbox" defaultChecked />
          <div className="collapse-title text-sm font-semibold">Retrieval hits</div>
          <div className="collapse-content space-y-2">
            {trace.retrieval_hits.length ? (
              trace.retrieval_hits.map((hit, idx) => (
                <div key={`${hit.doc_id ?? "doc"}-${idx}`} className="rounded-box border border-base-200 bg-base-200/60 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{hit.source ?? hit.doc_id ?? "unknown source"}</span>
                    <span className="badge badge-secondary badge-outline whitespace-nowrap px-3 py-1 text-xs font-semibold">
                      Rank {hit.rank ?? idx + 1}
                    </span>
                  </div>
                  {hit.score !== undefined && hit.score !== null ? (
                    <div className="text-[11px] text-base-content/60">Score {hit.score.toFixed(3)}</div>
                  ) : null}
                  {hit.snippet ? <div className="text-sm text-base-content">{hit.snippet}</div> : null}
                </div>
              ))
            ) : (
              <p className="text-xs text-base-content/60">Retrieval did not return usable context.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card bg-base-100 shadow-sm interactive-card">
          <div className="card-body space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-base-content/60">Verification</p>
              <span className={`badge ${verdictClass(trace.verification?.verdict)}`}>
                {trace.verification?.verdict ?? "n/a"}
              </span>
            </div>
            {trace.verification ? (
              <>
                <div className="text-xs text-base-content/70">Mode: {trace.verification.mode}</div>
                <div className="text-xs text-base-content/70">
                  Coverage: {(trace.verification.coverage * 100).toFixed(0)}%
                </div>
                {trace.verification.reason ? (
                  <div className="text-xs text-base-content/70">{trace.verification.reason}</div>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-base-content/60">No verification performed.</p>
            )}
          </div>
        </div>
        <div className="card bg-base-100 shadow-sm interactive-card">
          <div className="card-body space-y-2">
            <div className="text-xs font-semibold uppercase text-base-content/60">Synthesis notes</div>
            {trace.synthesis_notes.length ? (
              <ul className="space-y-1 text-xs text-base-content/80">
                {trace.synthesis_notes.map((note) => (
                  <li key={`${note.step}-${note.notes ?? ""}`}>
                    <span className="badge badge-outline badge-sm mr-2">{note.step}</span>
                    {note.notes ?? "No details."}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-base-content/60">No synthesis notes recorded.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
