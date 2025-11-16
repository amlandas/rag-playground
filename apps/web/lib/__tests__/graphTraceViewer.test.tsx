import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";

import GraphRagTraceViewer from "../../components/GraphRagTraceViewer";
import type { GraphRagTrace } from "../../lib/types";

const sampleTrace: GraphRagTrace = {
  request_id: "req-unit",
  session_id: "sess-123",
  query: "How many PTO references exist?",
  timestamp: new Date().toISOString(),
  config: {
    k: 3,
    max_hops: 2,
    temperature: 0.2,
    rerank_strategy: "ce",
    verification_mode: "ragv",
    model: "gpt-4o-mini",
    max_subqueries: 2,
  },
  planner: {
    sub_queries: [{ id: 1, text: "Find PTO policy details", stage: "sub-query", tags: ["root"] }],
    notes: null,
  },
  subqueries: [
    {
      id: 1,
      query: "Find PTO policy details",
      retrieval: {
        sub_query: "Find PTO policy details",
        documents: [
          {
            doc_id: "doc-1",
            chunk_index: 0,
            rank: 1,
            snippet: "PTO policy references remote guidelines.",
            dense_score: 0.9,
            lexical_score: 0.6,
            fused_score: 0.75,
            rerank_score: 0.88,
          },
        ],
        graph_paths: [],
        metrics: { hops_used: 1, graph_candidates: 2, hybrid_candidates: 3 },
      },
      rerank: {
        strategy: "ce",
        latency_ms: 12.5,
        top_documents: [
          {
            doc_id: "doc-1",
            chunk_index: 0,
            rank: 1,
            snippet: "PTO policy references remote guidelines.",
            rerank_score: 0.88,
          },
        ],
      },
      summary: { text: "PTO policy references remote guidelines. [S1]", citations: ["S1"] },
      warnings: [],
    },
  ],
  verification: {
    mode: "ragv",
    verdict: "supported",
    coverage: 1,
    notes: "All claims supported.",
  },
  synthesis: {
    answer: "Final answer",
    citations: [{ id: "S1" }],
    model: "gpt-4o-mini",
    notes: null,
  },
  warnings: [],
};

const html = renderToString(<GraphRagTraceViewer trace={sampleTrace} />);

assert(html.includes("Graph RAG Trace"));
assert(html.includes("Find PTO policy details"));
assert(html.includes("PTO policy"));

console.log("✅ Graph trace viewer renders without crashing");
