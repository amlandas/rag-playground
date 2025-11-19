import assert from "node:assert/strict";
import React from "react";
import { JSDOM } from "jsdom";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import ThemeSwitcher from "../../components/ThemeSwitcher";

async function runTest() {
const dom = new JSDOM("<!doctype html><html data-theme=\"light\"><body><div id=\"root\"></div></body></html>", {
  pretendToBeVisual: true,
  url: "https://example.com",
});
  const { window } = dom;

  (globalThis as any).window = window;
  (globalThis as any).document = window.document;
  (globalThis as any).HTMLElement = window.HTMLElement;
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  (globalThis as any).localStorage = window.localStorage;

  const container = window.document.getElementById("root") as HTMLElement;
  const root = createRoot(container);

  await act(async () => {
    root.render(<ThemeSwitcher />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  assert.strictEqual(
    window.document.documentElement.dataset.theme,
    "light",
    "ThemeSwitcher should default to light when no preference is stored",
  );

  root.unmount();
  delete (globalThis as any).window;
  delete (globalThis as any).document;
  delete (globalThis as any).HTMLElement;
  delete (globalThis as any).navigator;
  delete (globalThis as any).localStorage;

  console.log("✅ ThemeSwitcher defaults to Daylight when no saved theme is present");
}

void runTest();
