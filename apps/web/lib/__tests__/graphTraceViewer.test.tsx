import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";

import GraphRagTraceViewer from "../../components/GraphRagTraceViewer";
import type { GraphRagTrace } from "../../lib/types";

const mockTrace: GraphRagTrace = {
  request_id: "req-trace",
  mode: "graph_advanced",
  planner_steps: [
    { subquery: "Find PTO policy", hop: 0, notes: "root" },
    { subquery: "Check security rules", hop: 1 },
  ],
  retrieval_hits: [
    {
      doc_id: "doc-1",
      source: "doc-1",
      score: 0.98,
      rank: 1,
      snippet: "Policy snippet",
    },
  ],
  verification: { verdict: "pass", reason: "All evidence aligned." },
  synthesis_notes: [{ step: "initial_answer", notes: "Merged 2 steps." }],
  warnings: [],
};

const html = renderToString(<GraphRagTraceViewer trace={mockTrace} />);

assert(html.includes("graph_advanced"));
assert(html.includes("Find PTO policy"));
assert(html.includes("All evidence aligned."));

console.log("✅ Graph trace viewer renders with sample data");
