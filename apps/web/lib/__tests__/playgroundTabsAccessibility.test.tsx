import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";

import Playground from "../../app/playground/page";
import { AuthProvider } from "../../components/AuthProvider";

const ORIGINAL_GRAPH_FLAG = process.env.NEXT_PUBLIC_GRAPH_RAG_ENABLED;
process.env.NEXT_PUBLIC_GRAPH_RAG_ENABLED = "true";

function PlaygroundHarness() {
  return (
    <AuthProvider enabled={false} clientId="">
      <Playground />
    </AuthProvider>
  );
}

const html = renderToString(<PlaygroundHarness />);
process.env.NEXT_PUBLIC_GRAPH_RAG_ENABLED = ORIGINAL_GRAPH_FLAG;

assert(html.includes('role="tablist"'), "playground page should expose a tablist for modes");
["Simple", "A/B", "Graph"].forEach((label) => {
  assert(html.includes(label), `tablist should include the ${label} tab`);
});

console.log("✅ Playground tabs expose accessible structure");
