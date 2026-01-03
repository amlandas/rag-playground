'use client';

import Script from 'next/script';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { fetchSession, loginWithGoogle, logoutSession } from '../lib/rag-api';
import type { AuthSession, AuthUser } from '../lib/types';

const DEFAULT_AUTH_ENABLED =
  (process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED ?? "false").toLowerCase() === "true";
const DEFAULT_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

type AuthContextValue = {
  authEnabled: boolean;
  user: AuthUser | null;
  loading: boolean;
  gisReady: boolean;
  error: string | null;
  signIn: () => void;
  signOut: () => Promise<void>;
  refresh: (opts?: { silent?: boolean }) => Promise<AuthSession | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
  enabled?: boolean;
  clientId?: string | null;
};

const NOT_DISPLAYED_MESSAGES: Record<string, string> = {
  browser_not_supported: "This browser does not support Google Sign-In. Try Chrome or Firefox.",
  invalid_client: "Google Sign-In is misconfigured (invalid client).",
  missing_client_id: "Google Sign-In client ID is missing.",
  opt_out_or_no_session: "No Google session found. Sign in to Google and try again.",
  suppressed_by_user: "Google Sign-In was suppressed by the browser. Allow cookies or trackers and retry.",
  unregistered_origin: "This site is not authorized for Google Sign-In. Contact support.",
};

function describeNotDisplayedReason(reason?: string) {
  if (!reason) {
    return "Google Sign-In is unavailable in this browser. Try another browser or allow cookies.";
  }
  return NOT_DISPLAYED_MESSAGES[reason] ?? "Google Sign-In was blocked. Try another browser or allow cookies.";
}

export function AuthProvider({ children, enabled, clientId }: AuthProviderProps) {
  const authEnabled = enabled ?? DEFAULT_AUTH_ENABLED;
  const resolvedClientId = clientId ?? DEFAULT_CLIENT_ID;

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [gisReady, setGisReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState<boolean>(!authEnabled);
  const googleReadyRef = useRef(false);
  const signInAttemptRef = useRef(false);
  const promptTimeoutRef = useRef<number | null>(null);

  const clearPromptTimeout = useCallback(() => {
    if (promptTimeoutRef.current !== null) {
      window.clearTimeout(promptTimeoutRef.current);
      promptTimeoutRef.current = null;
    }
  }, []);

  const resetSignInAttempt = useCallback((reason?: string) => {
    if (signInAttemptRef.current && reason) {
      console.info('[auth] resetting sign-in attempt', reason);
    }
    clearPromptTimeout();
    signInAttemptRef.current = false;
    setLoading(false);
  }, [clearPromptTimeout]);

  const schedulePromptTimeout = useCallback(() => {
    clearPromptTimeout();
    promptTimeoutRef.current = window.setTimeout(() => {
      if (!signInAttemptRef.current) return;
      setError("Google Sign-In timed out. Please try again or allow cookies for this site.");
      resetSignInAttempt("prompt-timeout");
    }, 12000);
  }, [clearPromptTimeout, resetSignInAttempt]);

  const applySession = useCallback((session: AuthSession) => {
    if (!session.authenticated) {
      setUser(null);
      return;
    }
    setUser({ email: session.email, is_admin: session.is_admin });
  }, []);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!authEnabled) {
      setUser(null);
      setError(null);
      return null;
    }
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      const session = await fetchSession();
      applySession(session);
      return session;
    } catch (err: any) {
      console.error('[auth] refresh error', err);
      setError(err?.message ? String(err.message) : 'Failed to refresh session');
      setUser(null);
      return null;
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [applySession, authEnabled]);

  const handleCredential = useCallback(
    async (credential: string) => {
      if (!credential) {
        resetSignInAttempt('empty-credential');
        return;
      }
      console.info('[auth] credential received', {
        length: credential.length,
      });
      try {
        setLoading(true);
        setError(null);
        await loginWithGoogle(credential);
        const session = await refresh({ silent: true });
        if (session && !session.authenticated) {
          setError(
            "Signed in, but the session cookie was blocked. Please allow cookies or use a different browser.",
          );
        }
      } catch (err) {
        console.error('[auth] google login error', err);
        setError('Google sign-in failed. Please try again.');
      } finally {
        resetSignInAttempt('credential-finished');
      }
    },
    [refresh, resetSignInAttempt],
  );

  const initializeGoogle = useCallback(() => {
    if (!authEnabled || googleReadyRef.current || !resolvedClientId) {
      return;
    }
    const google = (window as any)?.google;
    if (!google?.accounts?.id) {
      return;
    }
    console.info('[auth] initializing Google Identity Services');
    google.accounts.id.initialize({
      client_id: resolvedClientId,
      callback: ({ credential }: { credential: string }) => {
        void handleCredential(credential);
      },
      auto_select: false,
      use_fedcm_for_prompt: false,
    });
    googleReadyRef.current = true;
    setGisReady(true);
  }, [authEnabled, resolvedClientId, handleCredential]);

  const handleScriptLoad = useCallback(() => {
    setScriptReady(true);
    console.info('[auth] GIS script loaded');
    initializeGoogle();
  }, [initializeGoogle]);

  useEffect(() => {
    if (!authEnabled) {
      setLoading(false);
      setGisReady(false);
      return;
    }
    void refresh();
  }, [authEnabled, refresh]);

  useEffect(() => {
    if (!authEnabled) return;

    if (scriptReady) {
      initializeGoogle();
    } else if ((window as any)?.google?.accounts?.id) {
      // Script already present in the page
      setScriptReady(true);
      initializeGoogle();
    }
  }, [authEnabled, scriptReady, initializeGoogle]);

  useEffect(() => {
    if (!authEnabled || !resolvedClientId) {
      setGisReady(false);
    }
  }, [authEnabled, resolvedClientId]);

  const signIn = useCallback(() => {
    if (!authEnabled) return;
    const google = (window as any)?.google;
    if (!google?.accounts?.id) {
      setError('Google Sign-In is still loading. Please wait a moment.');
      return;
    }
    if (signInAttemptRef.current) {
      console.warn('[auth] sign-in already in progress');
      return;
    }
    signInAttemptRef.current = true;
    setLoading(true);
    setError(null);
    console.info('[auth] prompting Google accounts');
    google.accounts.id.cancel?.();
    if (typeof google.accounts.id.prompt !== "function") {
      setError("Google Sign-In is unavailable. Please refresh and try again.");
      resetSignInAttempt("prompt-unavailable");
      return;
    }
    schedulePromptTimeout();
    google.accounts.id.prompt((notification: any) => {
      const isNotDisplayed = typeof notification?.isNotDisplayedMoment === "function"
        ? notification.isNotDisplayedMoment()
        : false;
      const notDisplayedReason = typeof notification?.getNotDisplayedReason === "function"
        ? notification.getNotDisplayedReason()
        : undefined;
      const dismissed = typeof notification?.getDismissedReason === 'function'
        ? notification.getDismissedReason()
        : undefined;
      const skipped = typeof notification?.getSkippedReason === 'function'
        ? notification.getSkippedReason()
        : undefined;
      const isDismissed = typeof notification?.isDismissedMoment === 'function'
        ? notification.isDismissedMoment()
        : !!dismissed;
      const isSkipped = typeof notification?.isSkippedMoment === 'function'
        ? notification.isSkippedMoment()
        : !!skipped;
      if (isNotDisplayed) {
        const message = describeNotDisplayedReason(notDisplayedReason);
        console.warn('[auth] GIS not displayed', notDisplayedReason ?? 'unknown');
        setError(message);
        resetSignInAttempt(`not_displayed:${notDisplayedReason ?? "unknown"}`);
        return;
      }
      if (isDismissed || isSkipped) {
        console.warn('[auth] GIS dismissed', dismissed ?? skipped ?? 'unknown');
        resetSignInAttempt(dismissed ?? skipped ?? 'dismissed');
      } else {
        // Check for success moment to set a safety watchdog
        const momentType = typeof notification?.getMomentType === 'function' ? notification.getMomentType() : undefined;
        if (momentType === 'credential_returned') {
          console.info('[auth] credential_returned received, waiting for callback...');
          // If the main callback doesn't fire within 5s, assume failure (e.g. strict origin policy blocking callback)
          setTimeout(() => {
            if (signInAttemptRef.current) {
              console.error('[auth] Login callback timed out. Origin mismatch?');
              setError('Login callback timed out. Please check console for origin errors.');
              resetSignInAttempt('timeout');
            }
          }, 8000);
        }
      }
    });
  }, [authEnabled, resetSignInAttempt, schedulePromptTimeout]);

  const signOut = useCallback(async () => {
    if (!authEnabled) {
      setUser(null);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      const google = (window as any)?.google;
      google?.accounts?.id?.cancel?.();
      signInAttemptRef.current = false;
      await logoutSession();
    } catch (err) {
      console.error('[auth] logout error', err);
    } finally {
      setLoading(false);
      setUser(null);
      setError(null);
    }
  }, [authEnabled]);

  const value = useMemo<AuthContextValue>(
    () => ({
      authEnabled,
      user,
      loading,
      gisReady,
      error,
      signIn,
      signOut,
      refresh,
    }),
    [authEnabled, user, loading, gisReady, error, signIn, signOut, refresh],
  );

  return (
    <AuthContext.Provider value={value}>
      {authEnabled && resolvedClientId ? (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={handleScriptLoad}
        />
      ) : null}
      {error ? (
        <div className="toast toast-end z-50">
          <div className="alert alert-error text-xs shadow">
            <span>{error}</span>
          </div>
        </div>
      ) : null}
      {children}
    </AuthContext.Provider>
  );
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext) ?? null;
}

export function useAuth(): AuthContextValue {
  const ctx = useOptionalAuth();
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
