import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";

import type { HealthDetails } from "../types";

function StorageLabel({ details, fallback }: { details?: HealthDetails | null; fallback: boolean }) {
  const effective = typeof details?.gcs_ingestion_enabled === "boolean" ? details.gcs_ingestion_enabled : fallback;
  return <span>{effective ? "Cloud-backed (GCS)" : "In-memory"}</span>;
}

const withTrue = renderToString(
  <StorageLabel details={{ gcs_ingestion_enabled: true } as HealthDetails} fallback={false} />,
);
assert(withTrue.includes("Cloud-backed (GCS)"));

const withFalse = renderToString(
  <StorageLabel details={{ gcs_ingestion_enabled: false } as HealthDetails} fallback={true} />,
);
assert(withFalse.includes("In-memory"));

const withMissingFallbackTrue = renderToString(<StorageLabel details={null} fallback />);
assert(withMissingFallbackTrue.includes("Cloud-backed (GCS)"));

console.log("✅ storage backend label tests passed");
