import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { TourProvider, useTour } from "../../components/TourProvider";

const html = renderToString(
  <TourProvider initialTourId="playground">
    <Status />
  </TourProvider>,
);

function Status() {
  const { isActive, currentStepId } = useTour();
  return <span data-active={isActive} data-step={currentStepId ?? ""} />;
}

assert(html.includes('data-active="true"'), "tour should become active after starting");
assert(html.includes('data-step="mode-tabs"'), "first tour step should be mode-tabs");

console.log("✅ Tour provider starts playground tour at mode-tabs");
