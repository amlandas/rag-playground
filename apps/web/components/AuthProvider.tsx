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
  (process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED ?? '').toLowerCase() === 'true';
const DEFAULT_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

type AuthContextValue = {
  authEnabled: boolean;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  signIn: () => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
  enabled?: boolean;
  clientId?: string | null;
};

export function AuthProvider({ children, enabled, clientId }: AuthProviderProps) {
  const authEnabled = enabled ?? DEFAULT_AUTH_ENABLED;
  const resolvedClientId = clientId ?? DEFAULT_CLIENT_ID;

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(authEnabled);
  const [error, setError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState<boolean>(!authEnabled);
  const googleReadyRef = useRef(false);

  const applySession = useCallback((session: AuthSession) => {
    if (!session.authenticated) {
      setUser(null);
      return;
    }
    setUser({ email: session.email, is_admin: session.is_admin });
  }, []);

  const refresh = useCallback(async () => {
    if (!authEnabled) {
      setUser(null);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const session = await fetchSession();
      applySession(session);
    } catch (err: any) {
      console.error('[auth] refresh error', err);
      setError(err?.message ? String(err.message) : 'Failed to refresh session');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [applySession, authEnabled]);

  const handleCredential = useCallback(
    async (credential: string) => {
      if (!credential) return;
      console.debug('[auth] credential received', {
        length: credential.length,
      });
      try {
        setLoading(true);
        setError(null);
        const next = await loginWithGoogle(credential);
        setUser(next);
      } catch (err) {
        console.error('[auth] google login error', err);
        setError('Google sign-in failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const initializeGoogle = useCallback(() => {
    if (!authEnabled || googleReadyRef.current || !resolvedClientId) {
      return;
    }
    const google = (window as any)?.google;
    if (!google?.accounts?.id) {
      return;
    }
    google.accounts.id.initialize({
      client_id: resolvedClientId,
      callback: ({ credential }: { credential: string }) => {
        void handleCredential(credential);
      },
      auto_select: false,
    });
    googleReadyRef.current = true;
  }, [authEnabled, resolvedClientId, handleCredential]);

  const handleScriptLoad = useCallback(() => {
    setScriptReady(true);
    initializeGoogle();
  }, [initializeGoogle]);

  useEffect(() => {
    if (!authEnabled) {
      setLoading(false);
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

  const signIn = useCallback(() => {
    if (!authEnabled) return;
    const google = (window as any)?.google;
    if (!google?.accounts?.id) {
      setError('Google Sign-In is still loading. Please wait a moment.');
      return;
    }
    google.accounts.id.prompt();
  }, [authEnabled]);

  const signOut = useCallback(async () => {
    if (!authEnabled) {
      setUser(null);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      await logoutSession();
    } catch (err) {
      console.error('[auth] logout error', err);
    } finally {
      setLoading(false);
      setUser(null);
    }
  }, [authEnabled]);

  const value = useMemo<AuthContextValue>(
    () => ({
      authEnabled,
      user,
      loading,
      error,
      signIn,
      signOut,
      refresh,
    }),
    [authEnabled, user, loading, error, signIn, signOut, refresh],
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
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
