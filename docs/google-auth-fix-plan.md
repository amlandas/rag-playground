# Scientia Laboratory Google Sign-In Fix Plan

## Goal
Stabilize Google Sign-In across browsers (especially Safari/ITP) and remove the "stuck loading" UX.

## Root causes (most likely)
1. One-Tap prompt is the primary sign-in path and is often suppressed by privacy settings.
2. Prompt "not displayed" moments are not handled, so loading state never clears.
3. API session cookie is third-party on Cloud Run default domains, so Safari blocks it.

## Implementation plan
### Phase 1: Frontend hardening (immediate)
- Correct GIS `prompt` usage and always reset loading state when the prompt is not displayed.
- Add a watchdog timeout for sign-in attempts that never resolve.
- Detect "cookie blocked" scenarios after `/api/auth/google` + `/api/auth/me` and surface a clear error.
- Render the official GIS button (`renderButton`) as the primary UX; keep the custom button as a fallback.

### Phase 2: Domain fix (near-term)
- Move services to subdomains under the same eTLD+1:
  - `scientia.simpleflo.dev` -> web
  - `api.scientia.simpleflo.dev` -> API
- Update:
  - OAuth "Authorized JavaScript origins"
  - `CORS_ALLOWED_ORIGINS`
  - `NEXT_PUBLIC_API_BASE_URL`

## Validation checklist
- Browser matrix: Chrome, Firefox, Safari (private + normal).
- Verify `/api/auth/google` succeeds and `/api/auth/me` returns authenticated.
- Confirm "Sign in" never remains stuck; failure shows a specific error.
- Smoke: `pnpm test:sanity` (web) and auth flow sanity in UI.

## Notes
- The domain change eliminates the Safari/ITP third-party cookie block.
- The UI hardening provides immediate relief even before DNS changes.

## Status (2026-01-02)
- Phase 1 implemented in web UI (prompt handling + watchdog + official GIS button).
- Phase 2 domain mappings are live for `scientia.simpleflo.dev` and `api.scientia.simpleflo.dev`.
- Pending: update OAuth "Authorized JavaScript origins" to include `https://scientia.simpleflo.dev`.
- Pending: update Cloud Build trigger substitutions for `_API_BASE_URL` and `_CORS_ALLOWED_ORIGINS`.
