"use client";

import React, { useEffect, useRef, useState } from "react";

import { useAuth } from "./AuthProvider";

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 533.5 544.3" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="#EA4335"
        d="M533.5 278.4c0-17.4-1.5-34.1-4.3-50.4H272v95.4h147.5c-6.4 34.7-25.9 64.1-55.3 83.7v69.5h89.7c52.5-48.3 82.6-119.4 82.6-198.2z"
      />
      <path
        fill="#34A853"
        d="M272 544.3c74.9 0 137.7-24.9 183.6-67.6l-89.7-69.5c-24.2 16.3-55.2 25.8-93.9 25.8-72.3 0-133.6-48.7-155.7-114.1H23.5v71.6C69.1 477.1 164.3 544.3 272 544.3z"
      />
      <path
        fill="#FBBC05"
        d="M116.3 318.9c-10.3-30.7-10.3-64 0-94.7v-71.6H23.5c-44.5 88.9-44.5 193.6 0 282.5l92.8-71.6z"
      />
      <path
        fill="#4285F4"
        d="M272 107.7c40.7-.6 79.2 15.7 107.7 44.3l80.4-80.4C409.7 24.4 343.8-1.9 272 0 164.3 0 69.1 67.2 23.5 164.3l92.8 71.6C138.4 156.4 199.7 107.7 272 107.7z"
      />
    </svg>
  );
}

type Props = {
  className?: string;
};

export default function GoogleSignInButton({ className }: Props) {
  const { authEnabled, loading, signIn, gisReady } = useAuth();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [gisRendered, setGisRendered] = useState(false);

  useEffect(() => {
    if (!authEnabled || !gisReady || gisRendered) return;
    const container = containerRef.current;
    const google = (window as any)?.google;
    if (!container || !google?.accounts?.id?.renderButton) return;
    container.innerHTML = "";
    try {
      google.accounts.id.renderButton(container, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "pill",
        width: 220,
      });
      setGisRendered(true);
    } catch (err) {
      console.warn("[auth] GIS renderButton failed", err);
    }
  }, [authEnabled, gisReady, gisRendered]);

  if (!authEnabled) return null;

  return (
    <div data-tour-id="sign-in" className={className}>
      <div ref={containerRef} className={gisRendered ? "" : "hidden"} aria-hidden={!gisRendered} />
      {!gisRendered ? (
        <button
          type="button"
          onClick={() => signIn()}
          className="btn btn-primary btn-sm interactive-button"
          disabled={loading}
        >
          {loading ? "Loading…" : (
            <span className="inline-flex items-center gap-2">
              <GoogleIcon className="h-4 w-4" />
              Sign in with Google
            </span>
          )}
        </button>
      ) : null}
    </div>
  );
}
