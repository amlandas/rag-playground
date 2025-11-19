import assert from "node:assert/strict";
import React, { useMemo, useState } from "react";
import { JSDOM } from "jsdom";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import { useGraphRunner } from "../../lib/useGraphRunner";

async function runTest() {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>");
  (globalThis as any).window = dom.window;
  (globalThis as any).document = dom.window.document;
  (globalThis as any).HTMLElement = dom.window.HTMLElement;

  function Harness({ execute }: { execute: () => Promise<any> }) {
  const [busy, setBusy] = useState<"idle" | "querying">("idle");
  const config = useMemo(
    () => ({
      state: {
        sessionId: "session-1",
        authRequired: false,
        authGateActive: false,
        indexed: true,
        query: "What is the vacation policy?",
        graphSettings: { k: 4, maxHops: 2, temperature: 0.2, rerank: "ce" as const, verificationMode: "ragv" as const },
        llmRerankAllowed: true,
        factCheckLlmAllowed: true,
      },
      actions: {
        setBusy,
        setAnswer: () => {},
        setAnswerComplete: () => {},
        setSources: () => {},
        setGraphResult: () => {},
        setGraphTrace: () => {},
        setShowGraphTrace: () => {},
        setError: () => {},
      },
      friendlyError: (err: unknown) => String(err ?? ""),
      executeGraphQuery: execute,
    }),
    [execute],
  );

  const runGraph = useGraphRunner(config);
  return (
    <button data-testid="run" onClick={() => {
      void runGraph();
    }}>
      {busy}
    </button>
  );
  }

  const container = window.document.getElementById("root") as HTMLElement;
  const root = createRoot(container);

  let executeCount = 0;
  let resolveRun: ((value: any) => void) | null = null;

  const execute = () => {
    executeCount += 1;
    return new Promise((resolve) => {
      resolveRun = (value) => resolve(value);
    });
  };

  act(() => {
    root.render(<Harness execute={execute} />);
  });

  const button = window.document.querySelector("[data-testid='run']") as HTMLButtonElement;

  act(() => {
    button.click();
  });

  assert.strictEqual(executeCount, 1, "First click should trigger graph query exactly once");
  assert.strictEqual(button.textContent, "querying", "Loading state should appear immediately");

  await act(async () => {
    resolveRun?.({ answer: "", subqueries: [], trace: null });
  });

  root.unmount();
  delete (globalThis as any).window;
  delete (globalThis as any).document;
  delete (globalThis as any).HTMLElement;

  console.log("✅ Graph run executes on first click and sets loading state");
}

void runTest();
