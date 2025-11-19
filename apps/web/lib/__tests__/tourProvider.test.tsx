import assert from "node:assert/strict";
import React from "react";
import { JSDOM } from "jsdom";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import { TourProvider, useTour } from "../../components/TourProvider";

async function runTests() {
  await testResolvesTargetRect();
  await testSkipsMissingTarget();
  console.log("✅ Tour provider resolves targets and skips missing steps");
}

async function testResolvesTargetRect() {
  const cleanup = setupDom('<div id="root"></div><div data-tour-id="mode-tabs"></div>');
  const element = document.querySelector('[data-tour-id="mode-tabs"]') as HTMLElement;
  element.getBoundingClientRect = () => createRect(120, 200, 220, 48);
  let scrolled = false;
  element.scrollIntoView = () => {
    scrolled = true;
  };

  const container = document.getElementById("root") as HTMLElement;
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <TourProvider initialTourId="playground">
        <Probe />
      </TourProvider>,
    );
    await wait(50);
  });

  const html = container.innerHTML;
  assert(html.includes('data-step="mode-tabs"'));
  assert(html.includes('data-top="120"'), "target rect top coordinate should be captured");
  assert(scrolled, "target element should be scrolled into view");

  root.unmount();
  cleanup();
}

async function testSkipsMissingTarget() {
  const cleanup = setupDom('<div id="root"></div><div data-tour-id="uploader-dropzone"></div>');
  const uploader = document.querySelector('[data-tour-id="uploader-dropzone"]') as HTMLElement;
  uploader.getBoundingClientRect = () => createRect(360, 160, 240, 64);
  uploader.scrollIntoView = () => {};

  const container = document.getElementById("root") as HTMLElement;
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <TourProvider initialTourId="playground">
        <Probe />
      </TourProvider>,
    );
    await wait(200);
  });

  const html = container.innerHTML;
  assert(
    html.includes('data-step="uploader"'),
    "missing target should advance to the next available step",
  );

  root.unmount();
  cleanup();
}

function Probe() {
  const { currentStepId, targetRect } = useTour();
  return <div data-step={currentStepId ?? ""} data-top={targetRect?.top ?? "none"} />;
}

function setupDom(markup: string) {
  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`, {
    pretendToBeVisual: true,
  });
  const { window } = dom;
  (globalThis as any).window = window;
  (globalThis as any).document = window.document;
  (globalThis as any).HTMLElement = window.HTMLElement;
  Object.defineProperty(globalThis, "navigator", {
    value: window.navigator,
    configurable: true,
  });
  (globalThis as any).ResizeObserver =
    (window as any).ResizeObserver ||
    class {
      observe() {}
      disconnect() {}
    };
  window.innerWidth = 1024;
  window.innerHeight = 768;
  return () => {
    delete (globalThis as any).window;
    delete (globalThis as any).document;
    delete (globalThis as any).HTMLElement;
    delete (globalThis as any).navigator;
    delete (globalThis as any).ResizeObserver;
  };
}

function createRect(top: number, left: number, width: number, height: number): DOMRect {
  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON() {
      return {};
    },
  } as DOMRect;
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

void runTests();
