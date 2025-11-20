import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";

import ThemeSwitcher from "../../components/ThemeSwitcher";
import GraphRagTraceViewer from "../../components/GraphRagTraceViewer";
import MetricsDrawer from "../../components/MetricsDrawer";
import type { GraphRagTrace } from "../../lib/types";

const themeHtml = renderToString(<ThemeSwitcher />);
assert(themeHtml.includes("hover:bg-base-300/40"), "Theme switcher should expose hover highlight class");

const sampleTrace: GraphRagTrace = {
  request_id: "trace-1",
  mode: "graph_advanced",
  warnings: [],
  planner_steps: [],
  retrieval_hits: [],
  verification: null,
  synthesis_notes: [],
  subqueries: [],
  trace: null,
};

const traceHtml = renderToString(<GraphRagTraceViewer trace={sampleTrace} />);
assert(traceHtml.includes("transition-all duration-200"), "Graph trace viewer should include easing classes");

const metricsHtml = renderToString(<MetricsDrawer />);
assert(metricsHtml.includes("transition-all duration-200"), "Metrics drawer should include transition classes");

console.log("✅ UI micro-interaction classes are present on key components");
