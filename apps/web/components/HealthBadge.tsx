"use client";

import { useEffect, useState } from "react";
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

  const color = ok === null ? "bg-gray-300" : ok ? "bg-green-500" : "bg-red-500";

  return (
    <div className="inline-flex items-center gap-2 text-sm">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="font-medium">
        {ok === null ? "Checking API…" : ok ? "API: healthy" : "API: error"}
      </span>
      {!ok && error ? <span className="text-gray-500">({error})</span> : null}
    </div>
  );
}
