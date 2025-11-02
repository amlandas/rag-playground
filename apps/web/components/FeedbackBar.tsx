"use client";

import { useState } from "react";
import { sendFeedback } from "../lib/rag-api";

export default function FeedbackBar({ queryId }: { queryId: string | null }) {
  const [sending, setSending] = useState<"up" | "down" | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!queryId) return null;
  if (done) {
    return <div className="text-xs text-green-700">Thanks for the feedback!</div>;
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
    <div className="flex items-center gap-2">
      <button
        className="rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
        disabled={!!sending}
        onClick={() => submit(1)}
      >
        👍 Helpful
      </button>
      <button
        className="rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
        disabled={!!sending}
        onClick={() => submit(-1)}
      >
        👎 Not helpful
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
