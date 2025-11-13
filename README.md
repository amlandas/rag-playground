# RAG Playground

## Overview
RAG Playground is a full-stack retrieval-augmented generation sandbox. It pairs a FastAPI backend with a Next.js playground so you can ingest documents, experiment with hybrid retrieval (FAISS + BM25 + MMR), apply CE/LLM rerankers, and stream grounded answers with citations. Optional Google Sign-In gates uploads/queries and unlocks an admin panel with live metrics and health diagnostics.

### Key Capabilities
- Hybrid dense + lexical retrieval with reciprocal rank fusion and optional MMR diversification.
- Answer composer that supports document-only (grounded) and doc + world context modes with sentence-level citations.
- Streaming SSE responses rendered as Markdown with confidence badges and citation panels.
- Configurable rerankers (cross-encoder or OpenAI LLM) controlled via environment variables.
- **(Experimental)** Advanced graph retrieval mode that blends lightweight graph traversal with hybrid retrievers for multi-hop questions (flagged off by default).
- Optional Google Sign-In auth (Google Identity Services) with session cookies and admin role support.
- Admin observability dashboard exposing metrics, health summaries, and auth diagnostics.

## Architecture
| Layer | Stack | Highlights |
| --- | --- | --- |
| Backend (`apps/api`) | FastAPI · Pydantic · FAISS · rank-bm25 | Ingestion, chunking, indexing, hybrid retrieval, reranking, answer composition, auth endpoints, metrics, health APIs |
| Frontend (`apps/web`) | Next.js 14 (App Router) · Tailwind · React Markdown | Playground UI, SSE streaming, auth provider, diagnostics, admin tools |
| Tooling | Poetry · pnpm · smoke scripts | `tools/dev_local.sh` launches API + web + smoke checks; tests via pytest and pnpm |

## Deployment Overview
- **Backend API** → Cloud Run service `rag-playground-api` built via `Dockerfile` in the repo root and deployed with `infra/gcp/deploy_cloud_run.sh`.
- **Frontend Web** → Cloud Run service `rag-playground-web` built with `apps/web/Dockerfile` and deployed using `infra/gcp/deploy_cloud_run_web.sh`.
- **CI/CD (recommended)** → Cloud Build triggers use `infra/gcp/cloudbuild.api.yaml` and `infra/gcp/cloudbuild.web.yaml` to build, push, and deploy automatically on each merge to `main`. See `DEPLOYMENT.md` for trigger + substitution setup.
- The web helper builds from `apps/web/` via Cloud Build; by default the bundle targets the deployed Cloud Run API URL but local `.env.local` can override `NEXT_PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`.
- Secrets (OpenAI keys, Google OAuth, session secrets) live in Cloud Run environment variables or Google Secret Manager—never in git.
- When auth is enabled, add the Cloud Run web URL to Google OAuth “Authorized JavaScript origins”.
- Set `CORS_ALLOWED_ORIGINS` on the API to include the Cloud Run web URL (and any local dev origins you need).

### Auth in Cloud Run
- The web and API services live on different Cloud Run origins, so Google Identity cookies must work cross-site. The backend automatically sets `SameSite=None; Secure` when at least one HTTPS, non-local origin is present in `CORS_ALLOWED_ORIGINS`.
- Required env vars:
  - API: `GOOGLE_AUTH_ENABLED`, `GOOGLE_CLIENT_ID`, `ADMIN_GOOGLE_EMAIL`, `SESSION_SECRET`, `CORS_ALLOWED_ORIGINS` (include both the web origin(s) and any local dev origins separated by commas).
  - Web: `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_API_BASE_URL`.
- GIS must load from the web origin. Ensure the OAuth client’s “Authorized JavaScript origins” list contains the Cloud Run web URL(s) and any developer origins.

### Advanced Graph Mode
- **Backend flags** (required for production Graph RAG): `GRAPH_ENABLED`, `MAX_GRAPH_HOPS`, `LLM_RERANK_ENABLED`, `FACT_CHECK_STRICT`, `FACT_CHECK_LLM_ENABLED`, `ADVANCED_MAX_SUBQUERIES`, `ADVANCED_DEFAULT_K`, `ADVANCED_DEFAULT_TEMPERATURE`. Cloud Build now sets each flag explicitly via `infra/gcp/cloudbuild.api.yaml`, so Cloud Run always reflects the trigger values.
- **Frontend flags**: `NEXT_PUBLIC_GRAPH_RAG_ENABLED`, `NEXT_PUBLIC_LLM_RERANK_ENABLED`, `NEXT_PUBLIC_FACT_CHECK_LLM_ENABLED`.
- **Pipeline**: `POST /api/query/advanced` executes planner → graph traversal → hybrid retrieval → CE/LLM rerank → per-sub-query LLM summarization → LLM synthesis → optional verification (RAG-V or fact-check LLM). If the OpenAI stack is unavailable (e.g., `EMBEDDINGS_PROVIDER=fake`), the pipeline gracefully falls back to deterministic summaries while still returning structured answers.
- **Diagnostics**: `/api/health/details` and `/api/metrics/summary` now surface `graph_enabled`, `advanced_graph_enabled`, `advanced_llm_enabled`, rerank/verification flags, and the advanced defaults so you can confirm prod configuration without redeploying.
- **UI**: when `NEXT_PUBLIC_GRAPH_RAG_ENABLED=true`, the playground shows a “Graph RAG (multi-stage)” mode with controls for k, hops, rerank (CE/LLM), verification, and live sub-query diagnostics.
- Graph data lives alongside the existing per-session index, so no additional infrastructure is required. Re-indexing a session rebuilds the graph idempotently.

## Prerequisites
- Python 3.11 with [Poetry](https://python-poetry.org/)
- Node.js 18+ with [pnpm](https://pnpm.io/) v8+
- OpenAI account with API access (or set `EMBEDDINGS_PROVIDER=fake` for offline experiments)
- (Optional) Google Cloud project with a Web OAuth 2.0 Client ID for Google Sign-In

## Quickstart (no auth)
```bash
# 1. Clone the repo
 git clone https://github.com/your-username/rag-playground.git
 cd rag-playground

# 2. Install dependencies
 pnpm install
 (cd apps/api && poetry install)

# 3. Copy env templates
 cp apps/api/.env.example apps/api/.env
 cp apps/web/.env.example apps/web/.env.local

# 4. Fill in required values
#   apps/api/.env        -> OPENAI_API_KEY=YOUR_OPENAI_API_KEY_HERE
#   apps/web/.env.local  -> NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# 5. Launch everything (FastAPI + Next.js + smoke check)
 ./tools/stop_local.sh || true
 ./tools/dev_local.sh
```
Open http://localhost:3000/playground and click **Use sample dataset → Build index → Ask “What is our PTO policy?”** to validate the end-to-end flow.

## Enabling Google Sign-In (optional)
1. **Create a Web OAuth 2.0 Client** in Google Cloud Console:
   - Authorized JavaScript origins: `http://localhost:3000` (and `http://localhost` if desired).
   - Authorized redirect URI: not required (Google Identity Services one-tap uses postMessage).
2. **Configure environment variables**:
   ```bash
   # API (apps/api/.env)
   GOOGLE_AUTH_ENABLED=true
   GOOGLE_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID_HERE
   ADMIN_GOOGLE_EMAIL=you@example.com
   SESSION_SECRET=CHANGE_ME_TO_A_LONG_RANDOM_STRING

   # Web (apps/web/.env.local)
   NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID_HERE
   ```
3. **Restart the stack**: `./tools/stop_local.sh || true && ./tools/dev_local.sh`
4. **Sign in** via the header button. The auth diagnostics panel confirms session state, and admins (matching `ADMIN_GOOGLE_EMAIL`) see the metrics/health dashboard.
   - Metrics are in-memory and reset whenever the API restarts.
   - Use the “Refresh data” button in the admin tools section to pull the latest counts.

## Admin Panel
- **Admin role**: any Google account matching `ADMIN_GOOGLE_EMAIL`.
- **Metrics summary**: totals for sessions, indices, queries, mode/confidence breakdowns, last query/error timestamps, active rerank strategy.
- **Health details**: server-reported rerank availability, default mode, and version string.
- **Auth diagnostics**: always visible when auth is enabled; shows client ID prefix, session info, and recent auth errors.

## Testing
```bash
# Backend
cd apps/api
poetry run pytest -q

# Frontend
cd ../web
pnpm test:sanity
```

## Secrets & Environment Variables
- Real secrets (OpenAI API keys, Google OAuth client IDs, session secrets) **must live in** untracked env files (`apps/api/.env`, `apps/web/.env.local`) or deployment platform variables.
- Example env files (`.env.example`) use safe placeholders—replace them with your own values locally and never commit the real secrets.
- The repo does not contain any actual OpenAI or Google credentials. Bring your own keys when cloning or forking.

## Deployment & Further Reading
- See [DEPLOYMENT.md](DEPLOYMENT.md) for Cloud Run automation scripts, environment configuration, and troubleshooting tips.
- Helpful tooling:
  - `tools/dev_local.sh` – launches API + web + smoke.
  - `tools/dev_web_docker.sh` – build/run the web Docker image locally with a configurable API base URL.
  - `./tools/smoke.sh https://your-api-url` – remote smoke once deployed.
  - QA regression harness: `poetry run pytest tests/test_eval_qa.py -q` inside `apps/api`.

## License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
