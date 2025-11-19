import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";

const originalGraphFlag = process.env.NEXT_PUBLIC_GRAPH_RAG_ENABLED;
process.env.NEXT_PUBLIC_GRAPH_RAG_ENABLED = "true";
const Playground = require("../../app/playground/page").default as typeof import("../../app/playground/page").default;
const { AuthProvider } = require("../../components/AuthProvider") as typeof import("../../components/AuthProvider");

function PlaygroundHarness() {
  return (
    <AuthProvider enabled={false} clientId="">
      <Playground />
    </AuthProvider>
  );
}

const html = renderToString(
  <div data-theme="dark">
    <PlaygroundHarness />
  </div>,
);

process.env.NEXT_PUBLIC_GRAPH_RAG_ENABLED = originalGraphFlag;

const label = "Run Graph RAG";
const labelIndex = html.indexOf(label);
assert(labelIndex !== -1, "Run Graph RAG button should render in graph mode");
const classAttributeStart = html.lastIndexOf("class=", labelIndex);
const snippet = html.slice(classAttributeStart, labelIndex);
assert(
  snippet.includes("btn btn-primary"),
  "Graph run button should use the primary button variant for dark theme contrast",
);

console.log("✅ Dark theme primary buttons render with btn-primary");
