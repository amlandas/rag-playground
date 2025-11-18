"use client";

import React, { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

export default function HealthBadge() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ status: string }>("/api/health")
      .then((j) => {
        if (!cancelled) {
          setOk(j.status === "ok");
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setOk(false);
          setError(e?.message || "API unreachable");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const badgeClass = ok === null ? "badge-ghost" : ok ? "badge-success" : "badge-error";
  const statusLabel =
    ok === null ? "Checking API…" : ok ? "API healthy" : "API error";

  return (
    <div className="tooltip tooltip-bottom" data-tip={error ?? "API connectivity check"}>
      <div className="badge badge-outline gap-2 text-xs font-semibold text-base-content">
        <span className={`badge ${badgeClass} badge-xs`} />
        {statusLabel}
      </div>
    </div>
  );
}
