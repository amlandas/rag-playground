# RAG Playground Authentication Survey

## Overview
The RAG Playground uses Google Identity Services (GIS) on the web app to obtain an ID token, calls `/api/auth/google` on the FastAPI backend, and stores the resulting session in a `rag_session` HTTP-only cookie. Subsequent browser calls (e.g., `/api/auth/me`, `/api/health`, file uploads) send `credentials: 'include'`, allowing the API to validate the session cookie before enabling uploads or admin tools.

Authentication behavior is coordinated across several layers: the Next.js client (AuthProvider + diagnostics UI), the shared API client (`rag-api.ts`) that honors `NEXT_PUBLIC_API_BASE_URL`, FastAPI’s CORS middleware (driven by `CORS_ALLOWED_ORIGINS`), cookie helpers (`session_auth.py`), and runtime configuration that can switch Google auth on/off via environment or Firestore flags. Health endpoints expose the effective configuration so the UI can display API status and auth diagnostics.

## Key components and files
### apps/web/app/layout.tsx
**Role:** Wraps every page with `AuthProvider`, passing through the GIS client ID and enabling flag derived from build-time env.

**Key responsibilities:**
- Reads `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
- Ensures all routes can access `useAuth()` context.

**Relevant snippets:**
```tsx
const googleAuthEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED?.toLowerCase() === "true";
const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
...
<AuthProvider enabled={googleAuthEnabled} clientId={googleClientId}>
  <div className="flex min-h-screen flex-col">{children}</div>
</AuthProvider>
```

### apps/web/components/AuthProvider.tsx
**Role:** Centralizes authentication state in the browser, initializes GIS, exchanges tokens with the API, and refreshes/clears local session state.

**Key responsibilities:**
- Uses GIS script to prompt Google sign-in and obtain ID tokens.
- Calls `fetchSession`, `loginWithGoogle`, and `logoutSession` with `credentials: 'include'`.
- Exposes `authEnabled`, `user`, `signIn`, `signOut`, and `refresh` to the UI.
- Handles errors shown in “Auth diagnostics”.

**Relevant snippets:**
```tsx
const DEFAULT_AUTH_ENABLED =
  (process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED ?? "false").toLowerCase() === "true";
...
const refresh = useCallback(async () => {
  if (!authEnabled) { ... }
  const session = await fetchSession();
  applySession(session);
}, [applySession, authEnabled]);

const handleCredential = useCallback(async (credential: string) => {
  await loginWithGoogle(credential);
  await refresh({ silent: true });
}, [refresh]);

const signIn = useCallback(() => {
  if (!authEnabled) return;
  const google = (window as any)?.google;
  google.accounts.id.prompt(...);
}, [authEnabled]);
```

### apps/web/lib/api.ts
**Role:** Resolves the API base URL used by all fetch helpers and logs it once per browser session.

**Key responsibilities:**
- Normalizes `NEXT_PUBLIC_API_BASE_URL` and exposes `getApiBaseUrl()`.
- Provides thin `apiGet`/`apiPost` utilities for unauthenticated checks (e.g., `/api/health`).

**Relevant snippets:**
```ts
export function resolveApiBase(env: EnvLike = process.env): string {
  const cleaned = env?.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!cleaned) {
    return FALLBACK_API_BASE_URL;
  }
  return cleaned.replace(/\/$/, "") || FALLBACK_API_BASE_URL;
}

export function getApiBaseUrl(): string {
  if (!loggedBaseUrl && typeof window !== "undefined") {
    console.log("[rag-api] Using API base URL:", API_BASE_URL);
    loggedBaseUrl = true;
  }
  return API_BASE_URL;
}
```

### apps/web/lib/rag-api.ts
**Role:** Implements all browser → API calls, guaranteeing that auth-dependent requests include cookies and that diagnostics hit `/api/health/details`.

**Key responsibilities:**
- Sets `credentials: 'include'` for `/api/auth/*`, upload/index/query endpoints, and admin metrics.
- Provides `fetchSession`, `loginWithGoogle`, `logoutSession`, and `fetchHealthDetails` helpers consumed by `AuthProvider` and diagnostics panels.

**Relevant snippets:**
```ts
export async function fetchSession(): Promise<AuthSession> {
  const res = await fetch(`${getApiBaseUrl()}/api/auth/me`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  ...
}

export async function loginWithGoogle(idToken: string): Promise<AuthUser> {
  const res = await fetch(`${getApiBaseUrl()}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ id_token: idToken }),
  });
  ...
}

export async function fetchHealthDetails(): Promise<HealthDetails> {
  const res = await fetch(`${getApiBaseUrl()}/api/health/details`, {
    method: "GET",
    cache: "no-store",
  });
  ...
}
```

### apps/web/components/HealthBadge.tsx
**Role:** Lightweight component rendered on landing + playground pages to ping `/api/health` and show connectivity status.

**Key responsibilities:**
- Calls `apiGet('/api/health')` using the resolved API base URL.
- Displays “API: healthy/error” banner shared across pages.

**Relevant snippets:**
```tsx
useEffect(() => {
  let cancelled = false;
  apiGet<{ status: string }>("/api/health")
    .then((j) => { if (!cancelled) setOk(j.status === "ok"); })
    .catch((e) => { if (!cancelled) { setOk(false); setError(e?.message || "API unreachable"); }});
  return () => { cancelled = true; };
}, []);
```

### apps/web/app/playground/page.tsx
**Role:** Main interactive UI that enforces auth gating, surfaces diagnostics, and lets admins inspect `/api/health/details` + `/api/auth/me`.

**Key responsibilities:**
- Calls `checkApiStatus()` (`fetch ${API_BASE}/api/health`) to populate the “API status” panel.
- Uses `useAuth()` to drive “Sign in with Google” button, Auth diagnostics, and gating of upload/index actions.
- Admin-only tools fetch metrics + health details through `fetchMetricsSummary()` / `fetchHealthDetails()`.

**Relevant snippets:**
```tsx
const checkApiStatus = useCallback(async () => {
  setApiStatus({ state: "checking", detail: "" });
  const response = await fetch(`${apiBaseUrl}/api/health`, { cache: "no-store" });
  if (!response.ok) throw new Error(...);
  setApiStatus({ state: "ok", detail: `reachable (${response.status})` });
}, [apiBaseUrl]);

<button onClick={() => signIn()} ...>
  <GoogleIcon className="h-4 w-4" />
  <span>{authLoading ? "Loading…" : "Sign in with Google"}</span>
</button>

<h2 className="text-sm font-semibold text-gray-900">Auth diagnostics</h2>
<dd>{String(authEnabled)}</dd>
<dd>{String(!!user)}</dd>
{authError ? <p className="mt-2 text-xs text-red-600">Authentication error: {authError}</p> : null}
```

### apps/api/app/config.py
**Role:** Defines strongly-typed backend settings, validates required auth inputs, and exposes `ALLOW_ORIGINS` + `GOOGLE_AUTH_ENABLED` fields consumed elsewhere.

**Key responsibilities:**
- Maps env vars (`GOOGLE_AUTH_ENABLED`, `CORS_ALLOWED_ORIGINS`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `ADMIN_GOOGLE_EMAIL`).
- Raises errors if auth is enabled without required secrets.

**Relevant snippets:**
```py
class Settings(BaseSettings):
    GOOGLE_AUTH_ENABLED: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "GOOGLE_AUTH_ENABLED",
            "GOOGLE__AUTH_ENABLED",
            "RAG_GOOGLE_AUTH_ENABLED",
        ),
    )
    ADMIN_GOOGLE_EMAIL: str | None = None
    ALLOW_ORIGINS: str | None = Field(
        default=None,
        validation_alias=AliasChoices("ALLOW_ORIGINS", "CORS_ALLOWED_ORIGINS", ...),
    )

    @model_validator(mode="after")
    def _finalize(self) -> "Settings":
        if self.GOOGLE_AUTH_ENABLED:
            if not self.GOOGLE_CLIENT_ID:
                raise ValueError("GOOGLE_CLIENT_ID is required when GOOGLE_AUTH_ENABLED=true")
            if not os.getenv("SESSION_SECRET"):
                raise ValueError("SESSION_SECRET environment variable is required when GOOGLE_AUTH_ENABLED=true")
        return self
```

### apps/api/app/services/runtime_config.py
**Role:** Computes feature flags (including Google auth) from env overrides and optionally Firestore, exposing `google_auth_enabled_effective()` used across routers.

**Key responsibilities:**
- Normalizes `_env_bool` for `GOOGLE_AUTH_ENABLED` and related flags.
- Optionally merges Firestore `runtime_config/<CONFIG_ENV>` documents.
- Provides metadata for health diagnostics.

**Relevant snippets:**
```py
class FeatureFlags(BaseModel):
    google_auth_enabled: bool = False
    graph_enabled: bool = False
    ...

def _load_env_config(config_env: str) -> RuntimeConfig:
    features = FeatureFlags(
        google_auth_enabled=_env_bool(("GOOGLE_AUTH_ENABLED", "RAG_GOOGLE_AUTH_ENABLED"), False),
        ...
    )
    return RuntimeConfig(environment=config_env, features=features, ...)


def google_auth_enabled_effective() -> bool:
    return get_runtime_config().features.google_auth_enabled
```

### apps/api/app/services/cors.py
**Role:** Normalizes `CORS_ALLOWED_ORIGINS` / `ALLOW_ORIGINS`, deduplicates entries, and supplies defaults used by both CORS middleware and cookie policies.

**Key responsibilities:**
- Provides `effective_cors_origins()` for cookie security decisions.
- Emitted summary (`cors_config_summary`) powers health diagnostics.

**Relevant snippets:**
```py
def parse_cors_origins(raw: str | None) -> List[str]:
    if not raw:
        return []
    origins: List[str] = []
    for chunk in raw.split(","):
        origin = chunk.strip()
        if not origin or origin in origins:
            continue
        origins.append(origin)
    return origins

def effective_cors_origins(raw: str | None) -> List[str]:
    parsed = parse_cors_origins(raw)
    if parsed:
        return parsed
    return list(DEFAULT_LOCAL_ORIGINS)
```

### apps/api/app/main.py
**Role:** Boots FastAPI, installs CORSMiddleware (allowing credentials), and logs the resolved origins.

**Key responsibilities:**
- Calls `cors_config_summary(settings.ALLOW_ORIGINS)` and prints the result.
- Adds CORSMiddleware with `allow_credentials=True`, which is essential for `fetch(..., credentials: 'include')`.

**Relevant snippets:**
```py
cors_origins, cors_source = cors_config_summary(settings.ALLOW_ORIGINS)
print(f"[CONFIG] cors allow_origins={cors_origins} source={cors_source}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### apps/api/app/services/session_auth.py
**Role:** Implements signed session tokens, cookie issuance/clearing, and helpers that enforce Google-auth gating.

**Key responsibilities:**
- Encodes/decodes `rag_session` using HMAC + `SESSION_SECRET`.
- Sets `Secure`/`SameSite=None` when any configured origin is HTTPS + non-local.
- `get_session_user`, `maybe_require_auth`, and `require_admin` consult `google_auth_enabled_effective()`.

**Relevant snippets:**
```py
SESSION_COOKIE_NAME = "rag_session"
...
def set_session_cookie(response: Response, token: str) -> None:
    secure = cookie_secure_flag()
    response.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        max_age=settings.SESSION_TTL_MINUTES * 60,
        httponly=True,
        secure=secure,
        samesite=cookie_samesite_policy(),
        path="/",
    )

def get_session_user(request: Request) -> Optional[SessionUser]:
    if not google_auth_enabled_effective():
        return None
    token = request.cookies.get(SESSION_COOKIE_NAME)
    ...
```

### apps/api/app/routers/auth.py
**Role:** Exposes `/api/auth/google`, `/api/auth/logout`, and `/api/auth/me`, coordinating token verification, cookie issuance, and admin detection.

**Key responsibilities:**
- Rejects requests when `google_auth_enabled_effective()` is false.
- Verifies GIS ID tokens via `google.oauth2.id_token.verify_oauth2_token`.
- Encodes admin flag if `ADMIN_GOOGLE_EMAIL` matches.
- Clears invalid cookies during `/api/auth/me`.

**Relevant snippets:**
```py
@router.post("/google")
def authenticate_with_google(payload: GoogleAuthRequest, response: Response):
    if not google_auth_enabled_effective():
        raise HTTPException(status_code=400, detail="Google authentication is disabled")
    info = id_token.verify_oauth2_token(...)
    token = encode_session_token({"sub": sub, "email": email, "is_admin": is_admin})
    set_session_cookie(response, token)
    return {"email": email, "is_admin": is_admin}

@router.get("/me")
def me(request: Request, response: Response):
    if not google_auth_enabled_effective():
        return {"authenticated": False}
    try:
        user = get_session_user(request)
    except HTTPException:
        clear_session_cookie(response)
        return {"authenticated": False}
    ...
```

### apps/api/app/routers/health.py
**Role:** Provides `/api/health` and `/api/health/details`, surfacing the effective auth + CORS configuration used by the frontend diagnostics.

**Key responsibilities:**
- Reports `google_auth_enabled`, `google_auth_effective`, `cors_allowed_origins`, and metadata about runtime-config source.
- UI reads this to show “API status” and “Auth diagnostics”.

**Relevant snippets:**
```py
@router.get("/health/details")
async def health_details():
    runtime_cfg = get_runtime_config()
    runtime_meta = get_runtime_config_metadata()
    cors_origins, cors_source = cors_config_summary(settings.ALLOW_ORIGINS)
    return {
        "google_auth_enabled": runtime_cfg.features.google_auth_enabled,
        "google_auth_effective": google_auth_enabled_effective(),
        ...
        "cors_allowed_origins": cors_origins,
        "cors_config_source": cors_source,
    }
```

## Auth-related configuration
### Frontend (build-time / runtime)
- `NEXT_PUBLIC_API_BASE_URL` – Resolved in `apps/web/lib/api.ts` to choose which Cloud Run URL the browser hits for `/api/...` calls.
- `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` – Read in `app/layout.tsx` + `AuthProvider.tsx` to decide whether GIS is loaded and whether uploads require auth.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` – Passed into `AuthProvider` so GIS can request the correct OAuth client.

### Backend (environment variables / secrets)
- `GOOGLE_AUTH_ENABLED` – Parsed in `app/config.py` and `app/services/runtime_config.py`; if true, `/api/auth/*` endpoints are enforced and GIS tokens must verify.
- `CORS_ALLOWED_ORIGINS` (aka `ALLOW_ORIGINS`) – Consumed by `app/services/cors.py` + `app/main.py` to configure `CORSMiddleware` and cookie security.
- `SESSION_SECRET` – Required when auth is enabled; used by `session_auth.py` to sign the `rag_session` cookie.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` – Stored in Secret Manager, injected into env for FastAPI token verification.
- `ADMIN_GOOGLE_EMAIL` – Determines which authenticated user is treated as admin when encoding cookies.

### Backend (Firestore runtime config)
- `runtime_config/<CONFIG_ENV>` may include `features.google_auth_enabled`. When `FIRESTORE_CONFIG_ENABLED=true`, `runtime_config.py` merges those flags; otherwise, env values are authoritative. (Other Firestore fields are for RAG tuning and do not alter auth.)

## End-to-end auth sequence
1. **Landing page load (`/`)**
   - Component: `apps/web/app/page.tsx` renders `HealthBadge`, which calls `/api/health` via `apiGet` → `getApiBaseUrl()`.
   - Expected headers: CORSMiddleware (configured in `app/main.py`) returns `Access-Control-Allow-Origin` for the configured origin and `Access-Control-Allow-Credentials: true` so credentialed requests succeed.

2. **Playground page load (`/playground`)**
   - Component: `apps/web/app/playground/page.tsx` mounts `AuthProvider` context, triggers `checkApiStatus()` (fetch `${API_BASE}/api/health`) and `useAuth().refresh()` (calls `/api/auth/me` with `credentials: 'include'`).
   - Health + auth diagnostics display the values returned by `/api/health/details` and the cached `AuthProvider` state.

3. **Google sign-in button click**
   - Component: `AuthProvider` (`signIn`) prompts GIS; GIS script returns an ID token via `handleCredential`, which invokes `loginWithGoogle()` from `rag-api.ts`. The POST request includes the ID token JSON body and `credentials: 'include'` so the resulting cookie is stored.

4. **Backend processing of `/api/auth/google`**
   - Files: `routers/auth.py`, `session_auth.py`, `config.py`, `runtime_config.py`.
   - Flow: `google_auth_enabled_effective()` must be true; FastAPI verifies the token against `settings.GOOGLE_CLIENT_ID`, infers admin status from `ADMIN_GOOGLE_EMAIL`, creates a signed payload via `encode_session_token`, and `set_session_cookie` writes `rag_session` with appropriate `Secure`/`SameSite` flags derived from `CORS_ALLOWED_ORIGINS`.

5. **Session refresh after login**
   - Frontend: `AuthProvider.refresh()` calls `fetchSession()` (`/api/auth/me`) with cookies included. Backend uses `get_session_user()` to decode the cookie; errors trigger `clear_session_cookie`. Successful responses mark the UI as authenticated, enabling file uploads, Build Index, and Run buttons in `playground/page.tsx`. Admin users additionally get Metrics + Health panels fed by `fetchMetricsSummary()` and `fetchHealthDetails()`.

## Tests
(No code changes were made; tests remain unchanged.)
