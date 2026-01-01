import React from "react";
import type { EvalResult } from "../lib/types";

type Props = {
    result: EvalResult;
    onReRun?: () => void;
};

function ScoreBar({ label, score, colorClass = "progress-primary" }: { label: string; score: number; colorClass?: string }) {
    return (
        <div className="flex flex-col gap-1 w-full">
            <div className="flex justify-between text-xs font-semibold">
                <span>{label}</span>
                <span>{score.toFixed(1)}/10</span>
            </div>
            <progress className={`progress w-full h-2 ${colorClass}`} value={score * 10} max="100"></progress>
        </div>
    );
}

export default function ScientificEvalDisplay({ result, onReRun }: Props) {
    const hasHallucinations = result.hallucination_rate > 0.1 || result.unsupported_claims.length > 0;
    const hasIrrelevantContext = result.irrelevant_context_spans.length > 0;

    return (
        <div className="rounded-box border border-base-200 bg-base-100 p-4 text-xs shadow-sm">
            <div className="flex justify-between items-center mb-3 border-b border-base-200 pb-2">
                <h3 className="font-bold text-sm uppercase tracking-wider text-primary">Scientific Methodology</h3>
                {onReRun && (
                    <button onClick={onReRun} className="btn btn-ghost btn-xs text-[10px] uppercase">
                        Re-run Judge
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-3">
                    <ScoreBar
                        label="Answer Relevance"
                        score={result.answer_relevance_score}
                        colorClass={result.answer_relevance_score > 7 ? "progress-success" : "progress-warning"}
                    />
                    <ScoreBar
                        label="Faithfulness"
                        score={result.faithfulness_score}
                        colorClass={hasHallucinations ? "progress-error" : "progress-success"}
                    />
                    <ScoreBar
                        label="Context Precision"
                        score={result.context_precision_score}
                        colorClass="progress-info"
                    />
                </div>
                <div className="space-y-3">
                    <ScoreBar
                        label="Context Recall"
                        score={result.context_recall_score}
                        colorClass="progress-info"
                    />
                    <ScoreBar
                        label="Completeness"
                        score={result.answer_completeness_score}
                        colorClass="progress-secondary"
                    />
                    <ScoreBar
                        label="Conciseness"
                        score={result.conciseness_score}
                        colorClass="progress-accent"
                    />
                </div>
            </div>

            {/* Hallucinations & Claims */}
            {hasHallucinations && (
                <div className="alert alert-warning text-xs py-2 mb-2 rounded-md">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-4 w-4" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <div className="flex flex-col gap-1 w-full">
                        <span className="font-bold">Potentially Unsupported Claims ({result.hallucination_rate.toFixed(2)} rate)</span>
                        <ul className="list-disc list-inside opacity-80">
                            {result.unsupported_claims.map((c, i) => (
                                <li key={i}><span className="font-semibold">"{c.claim}"</span>: {c.reason}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* Irrelevant Context */}
            {hasIrrelevantContext && (
                <div className="collapse collapse-arrow bg-base-200/50 rounded-md border border-base-200 mb-2">
                    <input type="checkbox" />
                    <div className="collapse-title font-semibold py-2 min-h-0 text-xs">
                        Irrelevant Context Spans ({result.irrelevant_context_spans.length})
                    </div>
                    <div className="collapse-content pb-2">
                        <ul className="list-disc list-inside space-y-1 opacity-80">
                            {result.irrelevant_context_spans.map((span, i) => (
                                <li key={i}><span className="font-mono bg-base-300 px-1 rounded">{span.chunk_id}</span>: {span.reason}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* Analysis Accordion */}
            <div className="collapse collapse-arrow bg-base-200/30 rounded-md border border-base-200">
                <input type="checkbox" />
                <div className="collapse-title font-semibold py-2 min-h-0 text-xs">
                    Judge's Analysis & Missing Info
                </div>
                <div className="collapse-content pb-2 space-y-2">
                    <div>
                        <span className="font-bold block">Critique:</span>
                        <p className="opacity-80 italic">{result.overall_comments}</p>
                    </div>
                    {result.missing_information.length > 0 && (
                        <div>
                            <span className="font-bold block text-error/80">Missing Information:</span>
                            <ul className="list-disc list-inside opacity-80 uppercase text-[10px]">
                                {result.missing_information.map((m, i) => <li key={i}>{m}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
