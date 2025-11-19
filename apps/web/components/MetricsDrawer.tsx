"use client";

import React, { useEffect, useId, useState } from "react";
import { fetchMetrics } from "../lib/rag-api";
import type { MetricsResponse } from "../lib/types";
import { SkeletonBlock, SkeletonLine } from "./Skeletons";

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

  const drawerId = useId();

  return (
    <div className={`drawer drawer-end ${open ? "drawer-open" : ""}`}>
      <input
        id={drawerId}
        type="checkbox"
        className="drawer-toggle"
        checked={open}
        onChange={() => setOpen((prev) => !prev)}
      />
      <div className="drawer-content">
        <button
          className="btn btn-secondary btn-xs"
          onClick={() => setOpen(true)}
        >
          {open ? "Hide metrics" : "Show metrics"}
        </button>
      </div>
      <div className="drawer-side z-30">
        <label
          htmlFor={drawerId}
          aria-label="Close metrics drawer"
          className="drawer-overlay"
          onClick={() => setOpen(false)}
        />
        <div className="menu w-full max-w-md bg-base-100 p-0 text-base-content sm:max-w-xl">
          <div className="card h-full rounded-none border-l border-base-200 shadow-2xl">
            <div className="card-body space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <h3 className="card-title text-base">Recent metrics</h3>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>
              {loading ? (
                <div className="space-y-4">
                  <SkeletonLine className="h-5 w-32" />
                  <SkeletonBlock lines={3} />
                </div>
              ) : error ? (
                <div className="alert alert-error text-xs">{error}</div>
              ) : data ? (
                <>
                  <div className="stats stats-vertical shadow sm:stats-horizontal">
                    <div className="stat">
                      <div className="stat-title">Events</div>
                      <div className="stat-value text-lg">{data.summary.count}</div>
                    </div>
                    <div className="stat">
                      <div className="stat-title">Avg latency</div>
                      <div className="stat-value text-lg">
                        {data.summary.avg_latency_ms?.toFixed(1) ?? "—"} ms
                      </div>
                    </div>
                    <div className="stat">
                      <div className="stat-title">Avg top sim</div>
                      <div className="stat-value text-lg">
                        {data.summary.avg_top_sim?.toFixed(3) ?? "—"}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase text-base-content/60">
                      Recent queries
                    </div>
                    <div className="max-h-64 rounded-box border border-base-300">
                      <div className="max-h-64 overflow-y-auto overflow-x-auto">
                        <table className="table table-zebra table-xs">
                          <thead>
                            <tr>
                              <th>Query ID</th>
                              <th>Latency</th>
                              <th>k</th>
                              <th>Top sim</th>
                              <th>Model</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.events.slice().reverse().map((event) => (
                              <tr key={event.query_id}>
                                <td>{event.query_id.slice(0, 8)}…</td>
                                <td>{event.latency_ms.toFixed(0)} ms</td>
                                <td>{event.k}</td>
                                <td>{event.top_similarity?.toFixed(3) ?? "—"}</td>
                                <td>{event.model}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-base-content/70">No data yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
