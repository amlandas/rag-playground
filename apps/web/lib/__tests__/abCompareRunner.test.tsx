import assert from "node:assert/strict";
import React, { useEffect, useMemo, useState } from "react";
import { JSDOM } from "jsdom";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import ProfileAnswerCard from "../../components/ProfileAnswerCard";
import { useCompareRunner } from "../useCompareRunner";
import type { CompareProfile, RetrievedChunk } from "../types";

type StreamAnswer = Parameters<typeof useCompareRunner>[0]["streamAnswer"];
type ExecuteCompare = Parameters<typeof useCompareRunner>[0]["executeCompare"];

function Harness({
  executeCompare,
  streamAnswer,
}: {
  executeCompare: NonNullable<ExecuteCompare>;
  streamAnswer: NonNullable<StreamAnswer>;
}) {
  const [busy, setBusy] = useState<"idle" | "comparing">("idle");
  const [retrievedA, setRetrievedA] = useState<RetrievedChunk[]>([]);
  const [retrievedB, setRetrievedB] = useState<RetrievedChunk[]>([]);
  const [answerA, setAnswerA] = useState("");
  const [answerB, setAnswerB] = useState("");
  const [answerAComplete, setAnswerAComplete] = useState(false);
  const [answerBComplete, setAnswerBComplete] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const profileA = useMemo<CompareProfile>(
    () => ({
      name: "A",
      k: 4,
      chunk_size: 600,
      overlap: 100,
      temperature: 0.2,
      model: "gpt-4o-mini",
    }),
    [],
  );
  const profileB = useMemo<CompareProfile>(
    () => ({
      name: "B",
      k: 4,
      chunk_size: 600,
      overlap: 100,
      temperature: 0.2,
      model: "gpt-4o-mini",
    }),
    [],
  );

  const config = useMemo(
    () => ({
      state: {
        sessionId: "session-123",
        authRequired: false,
        authGateActive: false,
        indexed: true,
        query: "What is the vacation policy?",
        profileA,
        profileB,
      },
      actions: {
        setBusy,
        setRetrievedA,
        setRetrievedB,
        setAnswerA,
        setAnswerB,
        setAnswerAComplete,
        setAnswerBComplete,
        setCompareError,
        setError,
      },
      friendlyError: (err: unknown) => String(err ?? ""),
      executeCompare,
      streamAnswer,
    }),
    [
      profileA,
      profileB,
      setBusy,
      setRetrievedA,
      setRetrievedB,
      setAnswerA,
      setAnswerB,
      setAnswerAComplete,
      setAnswerBComplete,
      setCompareError,
      setError,
      executeCompare,
      streamAnswer,
    ],
  );

  const runCompare = useCompareRunner(config);

  useEffect(() => {
    (window as any).__triggerCompare = () => runCompare();
    return () => {
      delete (window as any).__triggerCompare;
    };
  }, [runCompare]);

  return (
    <div>
      <button
        data-testid="run"
        type="button"
        onClick={() => {
          void runCompare();
        }}
        disabled={busy === "comparing"}
      >
        {busy}
      </button>
      {compareError ? <div data-testid="compare-error">{compareError}</div> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <ProfileAnswerCard
          label="Answer — Profile A"
          answer={answerA}
          isComplete={answerAComplete}
          sources={retrievedA}
          onCopy={() => {}}
          onDownload={() => {}}
        />
        <ProfileAnswerCard
          label="Answer — Profile B"
          answer={answerB}
          isComplete={answerBComplete}
          sources={retrievedB}
          onCopy={() => {}}
          onDownload={() => {}}
        />
      </div>
      {error ? <div data-testid="global-error">{error}</div> : null}
    </div>
  );
}

async function renderHarness({
  executeCompare,
  streamAnswer,
}: {
  executeCompare: NonNullable<ExecuteCompare>;
  streamAnswer: NonNullable<StreamAnswer>;
}) {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>");
  (globalThis as any).window = dom.window;
  (globalThis as any).document = dom.window.document;
  (globalThis as any).HTMLElement = dom.window.HTMLElement;

  const container = window.document.getElementById("root") as HTMLElement;
  const root = createRoot(container);

  await act(async () => {
    root.render(<Harness executeCompare={executeCompare} streamAnswer={streamAnswer} />);
  });

  return { root };
}

async function runAbCompareStreamsAnswers() {
  const retrieved: RetrievedChunk[] = [
    { rank: 1, doc_id: "doc-1", start: 0, end: 10, text: "Vacation policy is 15 days." },
  ];
  const executeCompare: NonNullable<ExecuteCompare> = async () => ({
    profile_a: retrieved,
    profile_b: retrieved,
  });
  const streamAnswer: NonNullable<StreamAnswer> = async (_prompt, snippets, _opts, handlers) => {
    handlers.onToken?.(`Answer from snippet ${snippets[0]?.rank ?? 0}`);
    handlers.onDone?.();
  };

  const { root } = await renderHarness({ executeCompare, streamAnswer });

  await act(async () => {
    await (window as any).__triggerCompare?.();
  });

  const renderedAnswers = window.document.querySelectorAll(".answer-body");
  assert.strictEqual(renderedAnswers.length, 2, "Both profile cards should render answers");
  renderedAnswers.forEach((node) => {
    assert.match(node.textContent ?? "", /Answer from snippet/, "Answer text should not be empty");
  });

  root.unmount();
  delete (globalThis as any).window;
  delete (globalThis as any).document;
  delete (globalThis as any).HTMLElement;
  delete (globalThis as any).__triggerCompare;

  console.log("✅ A/B runner renders streamed answers for both profiles");
}

async function runAbCompareFallback() {
  const executeCompare: NonNullable<ExecuteCompare> = async () => ({
    profile_a: [],
    profile_b: [],
  });
  const streamAnswer: NonNullable<StreamAnswer> = async (_prompt, snippets, _opts, handlers) => {
    if (!snippets.length) {
      handlers.onToken?.("I don't know from the provided snippets.");
    }
    handlers.onDone?.();
  };

  const { root } = await renderHarness({ executeCompare, streamAnswer });

  await act(async () => {
    await (window as any).__triggerCompare?.();
  });

  const renderedAnswers = window.document.querySelectorAll(".answer-body");
  assert.strictEqual(renderedAnswers.length, 2, "Fallback answers should still render");
  renderedAnswers.forEach((node) => {
    assert.match(
      node.textContent ?? "",
      /I don't know from the provided snippets\./,
      "Fallback grounded message should appear for both profiles",
    );
  });

  root.unmount();
  delete (globalThis as any).window;
  delete (globalThis as any).document;
  delete (globalThis as any).HTMLElement;
  delete (globalThis as any).__triggerCompare;

  console.log("✅ A/B runner surfaces grounded fallback answers when context is missing");
}

async function runTests() {
  await runAbCompareStreamsAnswers();
  await runAbCompareFallback();
}

void runTests();
