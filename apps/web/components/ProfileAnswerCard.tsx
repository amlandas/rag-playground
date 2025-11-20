import React from "react";

import { renderMarkdown } from "../lib/renderMarkdown";
import type { RetrievedChunk } from "../lib/types";

type Props = {
  label: string;
  answer: string;
  isComplete: boolean;
  sources: RetrievedChunk[];
  onCopy: () => void;
  onDownload: () => void;
};

export default function ProfileAnswerCard({ label, answer, isComplete, sources, onCopy, onDownload }: Props) {
  return (
    <div className="space-y-3 rounded-box border border-base-300 bg-base-100 p-3">
      <div className="text-sm font-semibold">{label}</div>
      <div className="prose prose-sm max-h-[60vh] min-h-[160px] overflow-auto rounded-box border border-base-200 bg-base-100 p-3">
        {renderMarkdown(answer, `${label} stream will appear here.`)}
      </div>
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
      <div>
        <div className="text-xs font-semibold uppercase text-base-content/60">Sources</div>
        <div className="rounded-box border border-base-200 bg-base-200/60 p-2">
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
            <p className="text-sm text-base-content/60">—</p>
          )}
        </div>
      </div>
    </div>
  );
}
