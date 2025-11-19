import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";

import Playground from "../../app/playground/page";
import { AuthProvider } from "../../components/AuthProvider";
import { TourProvider } from "../../components/TourProvider";

const html = renderToString(
  <AuthProvider enabled={false} clientId="">
    <TourProvider>
      <Playground />
    </TourProvider>
  </AuthProvider>,
);

function expectInteractive(dataAttr: string) {
  const pattern = new RegExp(`${dataAttr}[\\s\\S]{0,120}interactive-button`);
  assert(
    pattern.test(html),
    `button with ${dataAttr} should include interactive-button class`,
  );
}

expectInteractive('data-tour-id="run-button"');
expectInteractive('data-tour-id="build-index"');

console.log("✅ Playground key buttons include interactive hover styles");
