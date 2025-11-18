import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";

import AdvancedSettings from "../../components/AdvancedSettings";
import FeedbackBar from "../../components/FeedbackBar";
import HealthBadge from "../../components/HealthBadge";
import MetricsDrawer from "../../components/MetricsDrawer";
import Uploader from "../../components/Uploader";
import type { CompareProfile } from "../../lib/types";

const noopFiles = () => {
  /* noop */
};

const profile: CompareProfile = {
  name: "sample",
  k: 4,
  chunk_size: 800,
  overlap: 120,
  temperature: 0.2,
  model: "gpt-4o-mini",
};

{
  const html = renderToString(
    <Uploader disabled onFilesSelected={noopFiles} onUseSamples={async () => undefined} />,
  );
  assert(html.includes("border-dashed"), "uploader drop zone should use DaisyUI border classes");
}

{
  const html = renderToString(<FeedbackBar queryId="q-123" />);
  assert(html.includes("join"), "feedback buttons should share a DaisyUI join group");
}

{
  const html = renderToString(<MetricsDrawer />);
  assert(html.includes("drawer"), "metrics drawer should use DaisyUI drawer classes");
}

{
  const html = renderToString(
    <AdvancedSettings valueA={profile} valueB={profile} onChange={() => undefined} />,
  );
  assert(html.includes("card"), "advanced settings should render DaisyUI cards");
}

{
  const html = renderToString(<HealthBadge />);
  assert(html.includes("badge"), "health badge should render DaisyUI badges");
}

console.log("✅ DaisyUI component smoke tests passed");
