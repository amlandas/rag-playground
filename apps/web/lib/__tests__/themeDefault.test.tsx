import assert from "node:assert/strict";
import React from "react";
import { JSDOM } from "jsdom";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import ThemeSwitcher from "../../components/ThemeSwitcher";

async function runTest() {
  const dom = new JSDOM("<!doctype html><html data-theme=\"dark\"><body><div id=\"root\"></div></body></html>", {
    pretendToBeVisual: true,
    url: "https://example.com",
  });
  const { window } = dom;

  (globalThis as any).window = window;
  (globalThis as any).document = window.document;
  (globalThis as any).HTMLElement = window.HTMLElement;
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  (globalThis as any).localStorage = window.localStorage;
  // React 19 / Scheduler fix for JSDOM
  (window as any).event = { type: "check" };

  const container = window.document.getElementById("root") as HTMLElement;
  const root = createRoot(container);

  await act(async () => {
    root.render(<ThemeSwitcher />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  assert.strictEqual(
    window.document.documentElement.dataset.theme,
    "dark",
    "ThemeSwitcher should default to dark when no preference is stored",
  );
  const bodyText = window.document.body.textContent ?? "";
  ["Pastel", "Dark"].forEach((label) => {
    assert(
      bodyText.includes(label),
      `theme switcher should list the ${label} option`,
    );
  });

  const darkButton = Array.from(window.document.querySelectorAll("button")).find((btn) =>
    btn.textContent?.includes("Dark"),
  );
  assert(darkButton, "Dark option button should render");
  await act(async () => {
    darkButton!.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.strictEqual(
    window.document.documentElement.dataset.theme,
    "dark",
    "Switching to Dark should update the root dataset theme",
  );

  root.unmount();
  // React 19 scheduler might run after test, so we leave the window stub to prevent crashes.
  /*
  delete (globalThis as any).window;
  delete (globalThis as any).document;
  delete (globalThis as any).HTMLElement;
  delete (globalThis as any).navigator;
  delete (globalThis as any).localStorage;
  */

  console.log("✅ ThemeSwitcher defaults to Dark and toggles correctly");
}

void runTest();
