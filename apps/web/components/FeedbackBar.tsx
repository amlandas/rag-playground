"use client";

import React, { useState } from "react";
import { sendFeedback } from "../lib/rag-api";

export default function FeedbackBar({ queryId }: { queryId: string | null }) {
  const [sending, setSending] = useState<"up" | "down" | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!queryId) return null;
  if (done) {
    return (
      <div className="badge badge-success badge-outline text-xs">
        <span role="img" aria-hidden="true">
          ✅
        </span>{" "}
        Thanks for the feedback!
      </div>
    );
  }

  async function submit(rating: -1 | 1) {
    try {
      setSending(rating === 1 ? "up" : "down");
      setError(null);
      let reason: string | undefined;
      if (rating === -1) {
        reason = window.prompt("Optional: tell us why it wasn’t helpful (kept locally)") || undefined;
      }
      await sendFeedback(queryId, rating, reason);
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Could not send feedback");
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <div className="join">
        <button
          className="btn btn-xs join-item btn-ghost"
          disabled={!!sending}
          onClick={() => submit(1)}
        >
          👍 Helpful
        </button>
        <button
          className="btn btn-xs join-item btn-ghost"
          disabled={!!sending}
          onClick={() => submit(-1)}
        >
          👎 Not helpful
        </button>
      </div>
      {error ? (
        <div className="alert alert-error py-1 text-xs">
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}
