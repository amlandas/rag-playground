"use client";

import { useCallback, useEffect, useState } from "react";
import { castRunVote } from "../lib/rag-api";

type VoteType = "A" | "B" | "tie";

type Props = {
    sessionId: string;
    runId: string;
    initialVote?: VoteType;
    disabled?: boolean;
};

export default function VoteControls({ sessionId, runId, initialVote, disabled }: Props) {
    const [vote, setVote] = useState<VoteType | undefined>(initialVote);
    const [loading, setLoading] = useState(false);

    // Sync state if initialVote changes (e.g. changing history item)
    useEffect(() => {
        setVote(initialVote);
    }, [initialVote]);

    const handleVote = useCallback(
        async (v: VoteType) => {
            if (loading) return;
            setLoading(true);
            try {
                await castRunVote(sessionId, runId, v);
                setVote(v);
            } catch (err) {
                console.error("Vote failed", err);
                window.alert("Failed to cast vote. Check console.");
            } finally {
                setLoading(false);
            }
        },
        [sessionId, runId, loading]
    );

    return (
        <div className="flex flex-col items-center gap-2 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-base-content/70">
                Which answer is better?
            </p>
            <div className="join">
                <button
                    className={`btn join-item btn-sm ${vote === "A" ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => handleVote("A")}
                    disabled={disabled || loading}
                >
                    Vote A
                </button>
                <button
                    className={`btn join-item btn-sm ${vote === "tie" ? "btn-neutral" : "btn-ghost"}`}
                    onClick={() => handleVote("tie")}
                    disabled={disabled || loading}
                >
                    Tie
                </button>
                <button
                    className={`btn join-item btn-sm ${vote === "B" ? "btn-secondary" : "btn-ghost"}`}
                    onClick={() => handleVote("B")}
                    disabled={disabled || loading}
                >
                    Vote B
                </button>
            </div>
            {vote && <p className="text-xs text-success">Vote saved!</p>}
        </div>
    );
}
