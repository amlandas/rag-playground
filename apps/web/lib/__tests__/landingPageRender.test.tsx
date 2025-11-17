import React from "react";
import { renderToString } from "react-dom/server";

import Landing from "../../app/page";

try {
  const html = renderToString(<Landing />);
  if (!html.includes("RAG Playground for Simple")) {
    throw new Error("Landing page hero headline missing.");
  }
  if (!html.includes("Try the Playground")) {
    throw new Error("CTA button missing.");
  }
  console.log("✅ Landing page renders hero and CTA with DaisyUI.");
} catch (err) {
  console.error("Landing page render failed", err);
  process.exit(1);
}
