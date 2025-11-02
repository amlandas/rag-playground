"use client";

import { useEffect, useState } from "react";
import { fetchMetrics } from "../lib/rag-api";
import type { MetricsResponse } from "../lib/types";

export default function MetricsDrawer() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetchMetrics(25);
      setData(resp);
    } catch (err: any) {
      setError(err?.message || "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open]);

  return (
    <div className="relative">
      <button
        className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? "Hide metrics" : "Show metrics"}
      </button>
      {open ? (
        <div className="absolute right-0 z-10 mt-2 w-[28rem] rounded-lg border bg-white p-3 shadow">
          {loading ? (
            <div className="text-sm text-gray-600">Loading…</div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : data ? (
            <div className="space-y-3 text-sm">
              <div>
                <div>
                  <span className="font-semibold">Events:</span> {data.summary.count}
                </div>
                <div>
                  <span className="font-semibold">Avg latency:</span> {data.summary.avg_latency_ms?.toFixed(1) ?? "—"} ms
                </div>
                <div>
                  <span className="font-semibold">Avg top sim:</span> {data.summary.avg_top_sim?.toFixed(3) ?? "—"}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs uppercase text-gray-500">Recent queries</div>
                <div className="max-h-64 overflow-auto rounded border">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1 text-left">Query ID</th>
                        <th className="px-2 py-1 text-left">Latency</th>
                        <th className="px-2 py-1 text-left">k</th>
                        <th className="px-2 py-1 text-left">Top sim</th>
                        <th className="px-2 py-1 text-left">Model</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.events.slice().reverse().map((event) => (
                        <tr key={event.query_id} className="border-t">
                          <td className="px-2 py-1">{event.query_id.slice(0, 8)}…</td>
                          <td className="px-2 py-1">{event.latency_ms.toFixed(0)} ms</td>
                          <td className="px-2 py-1">{event.k}</td>
                          <td className="px-2 py-1">{event.top_similarity?.toFixed(3) ?? "—"}</td>
                          <td className="px-2 py-1">{event.model}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-600">No data yet.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
