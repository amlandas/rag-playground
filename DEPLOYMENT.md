# Deployment Guide (Cloud Run)

This repo ships with helper scripts and Dockerfiles so both services run on Google Cloud Run:
- **rag-playground-api** – FastAPI backend (`Dockerfile` at repo root).
- **rag-playground-web** – Next.js frontend (`apps/web/Dockerfile`).

Secrets (OpenAI keys, Google OAuth, session secret) are supplied via Cloud Run environment variables or Secret Manager—never committed to git.

## Prerequisites

1. Install the [gcloud CLI](https://cloud.google.com/sdk/docs/install) and authenticate:
   ```bash
   gcloud auth login
   ```
2. Select your project and enable required services:
   ```bash
   gcloud config set project <PROJECT_ID>
   gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
   ```
3. Ensure billing is enabled for the project.

## Automated Cloud Build CI/CD (recommended)

### 1. Connect GitHub → Cloud Build
- In **Google Cloud Console → Cloud Build → Triggers**, click **Manage repositories** and install the Cloud Build GitHub App for this repo.
- Authorize the `rag-playground` repository so triggers can watch pushes to `main`.

### 2. Prepare Artifact Registry & Secrets
- Ensure the Artifact Registry repository (default `us-west1-docker.pkg.dev/${PROJECT_ID}/rag-playground`) exists. The manual scripts already create it, but you can also run:
  ```bash
  gcloud artifacts repositories create rag-playground \
    --repository-format=docker \
    --location=us-west1 \
    --description="Images for rag-playground"
  ```
- Store sensitive values in **Secret Manager** (e.g., `OPENAI_API_KEY`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID` if you prefer not to expose it in Cloud Build logs).

### 3. Cloud Build trigger – API (`infra/gcp/cloudbuild.api.yaml`)
Create a trigger targeting branch `main` with:
- **Build config**: `infra/gcp/cloudbuild.api.yaml`
- **Substitutions** (mark secret ones as “Secret” in the UI):

| Key | Example | Notes |
| --- | --- | --- |
| `_IMAGE` | `us-west1-docker.pkg.dev/rag-playground-authn/rag-playground/rag-playground-api:$SHORT_SHA` | Unique image tag per build. |
| `_REGION` | `us-west1` | Optional override. |
| `_SERVICE_NAME` | `rag-playground-api` | Cloud Run service name. |
| `_EMBEDDINGS_PROVIDER` | `openai` | Backend embeddings provider. |
| `_FIRESTORE_CONFIG_ENABLED` | `false` | Enable Firestore-backed runtime config (`runtime_config/{CONFIG_ENV}`). |
| `_CONFIG_ENV` | `prod` | Which Firestore document to read (also used as the env fallback label). |
| `_CORS_ALLOWED_ORIGINS` | `https://rag-playground-web-908840126213.us-west1.run.app,http://localhost:3000` | Comma-separated origins (no brackets). |
| `_SECRET_VARS` | `OPENAI_API_KEY=openai-api-key:latest,SESSION_SECRET=session-secret:latest,GOOGLE_CLIENT_ID=google-client-id:latest,ADMIN_GOOGLE_EMAIL=admin-email:latest` | Each entry uses the `VAR=secret-name:version` format for `gcloud run --set-secrets`. Versions can be `latest` or a number. |

The pipeline:
1. Builds the API image with the repo-root `Dockerfile`.
2. Pushes to Artifact Registry.
3. Runs `gcloud run deploy` with the provided env + secret bindings.

### 4. Cloud Build trigger – Web (`infra/gcp/cloudbuild.web.yaml`)
- **Build config**: `infra/gcp/cloudbuild.web.yaml`
- Substitutions:

| Key | Example | Notes |
| --- | --- | --- |
| `_IMAGE` | `us-west1-docker.pkg.dev/rag-playground-authn/rag-playground/rag-playground-web:$SHORT_SHA` | Matches Artifact Registry repo. |
| `_SERVICE_NAME_WEB` | `rag-playground-web` | Cloud Run web service. |
| `_REGION` | `us-west1` |  |
| `_API_BASE_URL` | `https://rag-playground-api-908840126213.us-west1.run.app` | Baked into the Next.js build. |
| `_NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | `true` | Controls client auth UX. |
| `_NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `908840126213-xxxxxxxxxxxxxxxx.apps.googleusercontent.com` | Only required when auth on. |
| `_NEXT_PUBLIC_GRAPH_RAG_ENABLED` | `false` | Toggle Graph RAG UI. |
| `_NEXT_PUBLIC_LLM_RERANK_ENABLED` | `false` | Enable LLM rerank option in UI. |
| `_NEXT_PUBLIC_FACT_CHECK_LLM_ENABLED` | `false` | Enable LLM verification option in UI. |
| `_WEB_ENV_VARS` | `NEXT_PUBLIC_SOME_FLAG=value` (optional) | Additional runtime env vars. |
| `_PORT` / `_MEMORY` / `_CPU` | Defaults `3000`, `512Mi`, `1` | Override if needed. |

Steps:
1. Builds the Docker image with the supplied build args.
2. Pushes to Artifact Registry.
3. Deploys to Cloud Run with the provided runtime env vars.

### 5. End-to-end flow
1. Merge to `main`.
2. Cloud Build triggers kick off API + Web builds (each prints the deployed Cloud Run URL at the end).
3. Verify:
   ```bash
   curl -fsSL https://rag-playground-api-.../api/health
   curl -I     https://rag-playground-web-.../playground
   ```
4. Visit the web URL, upload a sample, build index, run a query (auth flow enforced if enabled).

> **Secrets tip:** `_SECRET_VARS` lets you keep sensitive data entirely in Secret Manager—just keep the secret names consistent across environments (e.g., `OPENAI_API_KEY` secret in each project).

---

## Deploy the API to Cloud Run (manual fallback)

1. Export the required environment variables from the repo root:
   ```bash
   export PROJECT_ID="your-gcp-project"
   export REGION="us-west1"
   export SERVICE_NAME="rag-playground-api"
   export REPO_NAME="rag-playground"

   export EMBEDDINGS_PROVIDER="openai"
   export OPENAI_API_KEY="sk-...your key..."
   export SESSION_SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')"
   export FIRESTORE_CONFIG_ENABLED="true"
   export CONFIG_ENV="prod"
   export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   export ADMIN_GOOGLE_EMAIL="your-email@gmail.com"
   export CORS_ALLOWED_ORIGINS="https://your-web-service.a.run.app"
   ```
   Set `FIRESTORE_CONFIG_ENABLED=false` (and optionally export `GOOGLE_AUTH_ENABLED`) only when you want to fall back to env-based flags for local testing. Otherwise, manage the runtime toggles via Firestore `runtime_config/{CONFIG_ENV}`.

2. Deploy:
   ```bash
   ./infra/gcp/deploy_cloud_run.sh
   ```
   The script validates required vars, builds an image with Cloud Build (`gcloud builds submit . --tag ...`), and deploys to Cloud Run.

3. Smoke test:
   ```bash
   curl -sS "https://<printed-api-url>/api/health"
   ```

## Deploy the Web App to Cloud Run

1. Export web-specific variables (plus `PROJECT_ID`, `REGION`, `REPO_NAME` if not already set):
   ```bash
   export SERVICE_NAME_WEB="rag-playground-web"
   export API_BASE_URL="https://rag-playground-api-xxxx.a.run.app"
   export NEXT_PUBLIC_GOOGLE_AUTH_ENABLED="false"
   export NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
   ```
   When auth is enabled, set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED="true"` and provide `NEXT_PUBLIC_GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"`.

2. Deploy:
   ```bash
   ./infra/gcp/deploy_cloud_run_web.sh
   ```
   The script builds straight from `apps/web/` with `gcloud builds submit`; the frontend defaults to the Cloud Run API URL baked in `apps/web/lib/api.ts`, but you can still override `NEXT_PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` via Cloud Run env vars or local `.env.local` during development.

3. Verify the site:
   ```bash
   curl -I "https://<printed-web-url>/playground"
   ```

## Post-deploy wiring

- **CORS**: Add the web Cloud Run URL (and any local dev origins) to `CORS_ALLOWED_ORIGINS` on the API service.
- **Google OAuth**: When auth is enabled, include the web Cloud Run URL in the OAuth client’s “Authorized JavaScript origins”.
- **Frontend config**: Set `NEXT_PUBLIC_API_BASE_URL` (handled by the web deploy script) to the API URL so all requests target the managed backend.
- **Secrets**: Update secrets via `gcloud run services update <service> --set-env-vars ...` or migrate sensitive values to Google Secret Manager with `--set-secrets`.

## Runtime configuration via Firestore

Advanced/Graph RAG tuning is stored in a Firestore collection so you can flip knobs without redeploying:

1. **Create the document** – In Firestore, add `runtime_config/{CONFIG_ENV}` (for example `runtime_config/prod`) with either the nested structure below (recommended) or top-level fields with the same names:
   ```json
   {
     "environment": "prod",
     "features": {
       "graph_enabled": true,
       "llm_rerank_enabled": true,
       "fact_check_llm_enabled": false,
       "fact_check_strict": false
     },
     "graph_rag": {
       "max_graph_hops": 2,
       "advanced_max_subqueries": 3,
       "advanced_default_k": 6,
       "advanced_default_temperature": 0.2
     }
   }
   ```
2. **Enable Firestore overrides** – Set `FIRESTORE_CONFIG_ENABLED=true` (Cloud Build substitution `_FIRESTORE_CONFIG_ENABLED`) and choose the environment via `_CONFIG_ENV`. The collection defaults to `runtime_config`, but you can override it with `RUNTIME_CONFIG_COLLECTION`.
3. **Fallback behavior** – If the document is missing or a field is absent, the API logs a warning and falls back to the corresponding env var (`GOOGLE_AUTH_ENABLED`, `GRAPH_ENABLED`, `MAX_GRAPH_HOPS`, etc.), so local dev keeps working without Firestore.
4. **What stays in env** – Infrastructure, provider selection, and secrets remain env/Secret Manager driven (`EMBEDDINGS_PROVIDER`, OpenAI key, Google OAuth client ID/secret, `SESSION_SECRET`, etc.). Firestore now owns the runtime feature flags listed above; use the legacy env vars only when Firestore config is disabled (e.g., local development).
5. **Diagnostics** – `/api/health/details` and `/api/metrics/summary` report the effective values plus `firestore_config_enabled`, `runtime_config_source`, and `config_env` so you can verify which source is in effect.
6. **Backward compatibility** – If you previously stored flat fields (e.g., `graph_enabled: true` at the document root) the API automatically normalizes them, but the nested `features` / `graph_rag` layout makes intent clearer going forward.

## Cost & Scaling Notes

- Each Cloud Run service scales independently from zero to N instances based on traffic. Start with the defaults (`--memory 512Mi --cpu 1` for web, default for API) and adjust if workloads grow.
- Because uploads and indices live in memory, redeploying the API clears active sessions. Consider external storage if persistence is required.
- Keep an eye on egress between services if you move them to different regions—deploying both in the same region keeps latency low and costs predictable.

## Testing Before Deploy

Run the local test suites to ensure reproducible builds:
```bash
SESSION_SECRET=local-test-secret poetry run pytest -q   # apps/api
cd apps/web && pnpm test:sanity                       # apps/web
```
- **Environment parity**: Use the Firestore runtime config (`google_auth_enabled`) to toggle API auth in every environment. Export `GOOGLE_AUTH_ENABLED` only when Firestore overrides are disabled (for example, purely local deployments). The frontend still needs `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` to decide whether to show the Sign-In UI.

## Enabling Google Sign-In

1. **Create a Google OAuth “Web application” client.** Copy the Client ID and add both `https://rag-playground-web-<project>.a.run.app` and `https://rag-playground-api-<project>.a.run.app` (if you call auth endpoints directly) to the “Authorized JavaScript origins” list. No client secret is needed for token verification.
2. **Configure the API service.**
   ```bash
   export FIRESTORE_CONFIG_ENABLED="true"
   export CONFIG_ENV="prod"
   export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   export ADMIN_GOOGLE_EMAIL="admin@example.com"
   export SESSION_SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')"
   export CORS_ALLOWED_ORIGINS="https://rag-playground-web-XXXX.a.run.app,https://rag-playground-web-fsx6dmftva-uw.a.run.app"
   ./infra/gcp/deploy_cloud_run.sh
   ```
   Set `"google_auth_enabled": true` (and any other desired flags) inside `runtime_config/{CONFIG_ENV}`. `ADMIN_GOOGLE_EMAIL` gates admin-only UI/actions; omit or change it to adjust.
3. **Configure the web service.**
   ```bash
   export NEXT_PUBLIC_GOOGLE_AUTH_ENABLED="true"
   export NEXT_PUBLIC_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   ./infra/gcp/deploy_cloud_run_web.sh
   ```
4. **Validate.** Open the Cloud Run web URL, ensure “Sign in with Google” appears, and verify upload/index/query after authenticating. Health badge/API status should show reachable, and the API `/api/auth/me` endpoint should return `{ "authenticated": true, ... }` when cookies are present.

> Because the API and web Cloud Run services run on different origins, keep the production web origin listed in `CORS_ALLOWED_ORIGINS` even if you add local dev values. When at least one non-local HTTPS origin is present, the backend automatically issues `SameSite=None; Secure` cookies so GIS sessions flow across both services.
