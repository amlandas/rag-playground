import React from "react";

import { renderMarkdown } from "../lib/renderMarkdown";
import type { RetrievedChunk, EvalResult } from "../lib/types";
import ScientificEvalDisplay from "./ScientificEvalDisplay";

type Props = {
  label: string;
  answer: string;
  isComplete: boolean;
  sources: RetrievedChunk[];
  onCopy: () => void;
  onDownload: () => void;
  metrics?: { latency_ms?: number; tokens_in?: number; tokens_out?: number };
  evalResult?: EvalResult | null;
  evalLoading?: boolean;
  onRunEval?: () => void;
};

export default function ProfileAnswerCard({
  label,
  answer,
  isComplete,
  sources,
  onCopy,
  onDownload,
  evalResult,
  evalLoading,
  onRunEval,
}: Props) {
  return (
    <div className="space-y-3 rounded-box border border-base-300 bg-base-100 p-3">
      <div className="text-sm font-semibold">{label}</div>
      <div className="prose prose-sm max-h-[60vh] min-h-[160px] overflow-auto rounded-box border border-base-200 bg-base-100 p-3">
        {renderMarkdown(answer, `${label} stream will appear here.`)}
      </div>

      {onRunEval && answer && (
        <div className="mt-2 space-y-2">
          <div className="flex justify-between items-center">
            {!evalResult && (
              <button
                onClick={onRunEval}
                disabled={evalLoading}
                className="btn btn-xs btn-outline"
              >
                {evalLoading ? "Running Judge..." : "Run Eval"}
              </button>
            )}
          </div>
          {!evalResult && (
            <div className="text-[10px] text-base-content/50 italic px-1">
              Note: AI-based evals may produce non-deterministic results.
            </div>
          )}


          {evalResult && (
            <ScientificEvalDisplay result={evalResult} onReRun={onRunEval} />
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 text-xs">
        <button type="button" onClick={onCopy} disabled={!answer} className="btn btn-ghost btn-xs">
          Copy
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={!isComplete || !answer}
          className="btn btn-ghost btn-xs"
        >
          Download .md
        </button>
      </div>
      <details className="group">
        <summary className="cursor-pointer list-none">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-base-content/60 hover:text-base-content transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 transition-transform group-open:rotate-90">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            Show Evidence ({sources.length})
          </div>
        </summary>
        <div className="mt-2 rounded-box border border-base-200 bg-base-200/60 p-2">
          {sources.length ? (
            <ul className="space-y-2 text-sm">
              {sources.map((source) => (
                <li key={`${label}-${source.rank}`}>
                  <div className="font-semibold">[{source.rank}] doc {source.doc_id.slice(0, 8)}…</div>
                  <div className="text-base-content/70 line-clamp-4">{source.text}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-base-content/60">No retrieval evidence available.</p>
          )}
        </div>
      </details>
    </div>
  );
}
