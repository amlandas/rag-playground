import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";

import Playground from "../../app/playground/page";
import { TourProvider } from "../../components/TourProvider";
import { AuthProvider } from "../../components/AuthProvider";

const html = renderToString(
  <AuthProvider enabled={false} clientId="">
    <TourProvider>
      <Playground />
    </TourProvider>
  </AuthProvider>,
);

const heroIndex = html.indexOf("RAG Playground");
const docsIndex = Math.max(html.indexOf("Documents & session"), html.indexOf("Documents &amp; session"));
const askIndex = html.indexOf("Ask a question");
const apiIndex = html.indexOf("API status");

assert(heroIndex !== -1 && docsIndex !== -1 && askIndex !== -1 && apiIndex !== -1);
assert(
  heroIndex < docsIndex && docsIndex < askIndex && askIndex < apiIndex,
  "playground layout should render hero, documents, ask, then API status in order",
);

console.log("✅ Playground layout renders hero → documents → ask → API status");
