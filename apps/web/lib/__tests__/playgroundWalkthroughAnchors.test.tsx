import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";

import Playground from "../../app/playground/page";
import { TourProvider } from "../../components/TourProvider";
import { AuthProvider } from "../../components/AuthProvider";

function Harness() {
  return (
    <AuthProvider enabled={false} clientId="">
      <TourProvider>
        <Playground />
      </TourProvider>
    </AuthProvider>
  );
}

const html = renderToString(<Harness />);

[
  "mode-tabs",
  "uploader-dropzone",
  "build-index",
  "query-input",
  "run-button",
].forEach((id) => {
  assert(
    html.includes(`data-tour-id="${id}"`),
    `walkthrough anchor ${id} should be present in the playground markup`,
  );
});

console.log("✅ Playground walkthrough anchors render as expected");
