import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { TourProvider, useTour } from "../../components/TourProvider";

function Status() {
  const { isActive, currentStepId } = useTour();
  return <span data-active={isActive} data-step={currentStepId ?? ""} />;
}

const html = renderToString(
  <TourProvider initialTourId="playground">
    <Status />
  </TourProvider>,
);

assert(html.includes('data-active="true"'), "tour should become active after starting");
assert(html.includes('data-step="mode-tabs"'), "first tour step should be mode-tabs when auth disabled");

const htmlWithSignIn = renderToString(
  <TourProvider
    initialTourId="playground"
    authStateOverride={{ authEnabled: true, isAuthenticated: false }}
  >
    <Status />
  </TourProvider>,
);

assert(
  htmlWithSignIn.includes('data-step="sign-in"'),
  "tour should start with sign-in step when auth is enabled but user is signed out",
);

console.log("✅ Tour provider adapts starting step to auth state");
