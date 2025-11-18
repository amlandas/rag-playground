import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";

import Playground from "../../app/playground/page";
import { AuthProvider } from "../../components/AuthProvider";

function PlaygroundHarness() {
  return (
    <AuthProvider enabled={false} clientId="">
      <Playground />
    </AuthProvider>
  );
}

const html = renderToString(<PlaygroundHarness />);

["Simple", "A/B", "Graph RAG"].forEach((label) => {
  assert(
    html.includes(label),
    `playground UI should render the "${label}" label so modes remain visible`,
  );
});

console.log("✅ Playground mode selector renders all required labels");
