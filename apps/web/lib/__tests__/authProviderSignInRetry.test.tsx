import assert from "node:assert/strict";
import React, { useImperativeHandle } from "react";
import { JSDOM } from "jsdom";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import { AuthProvider, useAuth } from "../../components/AuthProvider";

async function runAuthRetryScenario() {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
    url: "https://example.com",
  });

  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true });
  Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true });
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  Object.defineProperty(globalThis, "HTMLElement", { value: dom.window.HTMLElement, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: dom.window.localStorage, configurable: true });

  let loggedIn = false;

  const requests: string[] = [];

  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;
    requests.push(url);
    if (url.includes("/api/auth/me")) {
      return new Response(
        JSON.stringify({ authenticated: loggedIn, email: "user@example.com", is_admin: false }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/api/auth/google")) {
      loggedIn = true;
      return new Response(
        JSON.stringify({ email: "user@example.com", is_admin: false }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/api/auth/logout")) {
      loggedIn = false;
      return new Response("", { status: 200 });
    }
    return new Response("{}", { status: 200 });
  };

let credentialCallback: ((payload: { credential: string }) => void) | null = null;
const promptCallbacks: Array<(notification: any) => void> = [];
let cancelCount = 0;
let gisInitialized = false;

  const googleStub = {
    accounts: {
      id: {
        initialize: (config: { callback: (payload: { credential: string }) => void }) => {
          gisInitialized = true;
          credentialCallback = config.callback;
        },
        prompt: (_config: any, callback?: (notification: any) => void) => {
          if (callback) {
            promptCallbacks.push(callback);
          }
        },
        cancel: () => {
          cancelCount += 1;
        },
      },
    },
  };

  Object.defineProperty(globalThis, "google", {
    configurable: true,
    value: googleStub,
  });
  Object.defineProperty(dom.window, "google", {
    configurable: true,
    value: googleStub,
  });

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  const waitForCondition = async (predicate: () => boolean) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (predicate()) {
        return;
      }
      await flush();
    }
    assert(predicate(), "condition timed out");
  };
  const waitForLoading = async (expected: boolean, ref: { current: AuthHandle | null }) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (!!ref.current?.loading === expected) {
        return;
      }
      await flush();
    }
    assert.strictEqual(!!ref.current?.loading, expected);
  };

  type AuthHandle = ReturnType<typeof useAuth>;

  const AuthController = React.forwardRef<AuthHandle | null>((_, ref) => {
    const ctx = useAuth();
    useImperativeHandle(ref, () => ctx, [ctx]);
    return null;
  });
  AuthController.displayName = "AuthController";

  const container = dom.window.document.getElementById("root") as HTMLElement;
  const root = createRoot(container);
  const controllerRef = { current: null as AuthHandle | null };

  await act(async () => {
    root.render(
      <AuthProvider enabled clientId="client-id">
        <AuthController ref={controllerRef} />
      </AuthProvider>,
    );
    await flush();
  });

  assert(controllerRef.current, "Auth context should be available after mount");
  await waitForLoading(false, controllerRef);
  await waitForCondition(() => gisInitialized && typeof credentialCallback === "function");

  await act(async () => {
    controllerRef.current!.signIn();
  });

  assert(credentialCallback, "GIS credential callback should be registered");
  await act(async () => {
    credentialCallback?.({ credential: "token-1" });
    await flush();
    await flush();
  });

  assert(
    requests.some((url) => url.includes("/api/auth/google")),
    "login request should hit google endpoint",
  );
  assert.strictEqual(loggedIn, true, "login endpoint should mark session authenticated");
  assert.strictEqual(promptCallbacks.length, 1, "first sign-in should prompt once");

  await act(async () => {
    await controllerRef.current!.signOut();
    await flush();
  });

  await waitForLoading(false, controllerRef);
  assert.strictEqual(loggedIn, false, "logout should clear session flag");

  await act(async () => {
    controllerRef.current!.signIn();
  });

  await act(async () => {
    credentialCallback?.({ credential: "token-2" });
    await flush();
    await flush();
  });

  assert.strictEqual(promptCallbacks.length, 2, "sign-in should be re-entrant after logout");
  assert(cancelCount >= 1, "logout should cancel any pending FedCM prompt");
  const googleCalls = requests.filter((url) => url.includes("/api/auth/google")).length;
  assert.strictEqual(googleCalls, 2, "google login endpoint should be hit twice");
  assert.strictEqual(loggedIn, true, "second login should succeed");

  root.unmount();
  delete (globalThis as any).window;
  delete (globalThis as any).document;
  delete (globalThis as any).navigator;
  delete (globalThis as any).HTMLElement;
  delete (globalThis as any).localStorage;
  delete (globalThis as any).google;
  delete (globalThis as any).fetch;

  console.log("✅ Auth provider allows sign-in after logout without AbortError");
}

void runAuthRetryScenario();
