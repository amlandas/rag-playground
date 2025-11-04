# Deployment Guide

This project deploys as two services:
- **API** (`apps/api`) → containerised FastAPI app on Render (Docker blueprint via root `render.yaml`).
- **Web** (`apps/web`) → Next.js frontend on Vercel pointing at the Render API URL.

## Prerequisites
- GitHub repository containing this code.
- Render account linked to GitHub (Blueprint deploys enabled).
- Vercel account linked to GitHub.
- OpenAI API key with access to `text-embedding-3-large` (or adjust models).
- (Optional) Google Cloud credentials if enabling Google Sign-In.

## 1. Deploy the API to Render
1. Push the repo to GitHub.
2. In Render, choose **New → Blueprint** and select this repository. The root `render.yaml` provisions the API service.
3. Set environment variables (Render → Blueprint → Variables):
   - `OPENAI_API_KEY` – required unless you run in fake embeddings mode.
   - `EMBEDDINGS_PROVIDER=openai` – default production provider.
   - `ALLOW_ORIGINS` – comma-separated list of allowed web origins (set after the first deploy once the Vercel URL is known).
   - Retrieval & answer knobs (override as needed):
     - `SIMILARITY_FLOOR`, `MAX_FILES_PER_UPLOAD`, `MAX_FILE_MB`, `MAX_PAGES_PER_PDF`.
     - `ANSWER_MODE_DEFAULT`, `ANSWER_CONFIDENCE_ENABLED`, `RERANK_STRATEGY`, `CE_MODEL_NAME`, etc.
   - (For Google auth, after Step F3) `GOOGLE_AUTH_ENABLED`, `GOOGLE_CLIENT_ID`, `ADMIN_GOOGLE_EMAIL`, `SESSION_SECRET`.
4. Deploy. Copy the external URL, e.g. `https://rag-playground-api.onrender.com`.
5. After the API is live, add `ALLOW_ORIGINS=https://<your-vercel-project>.vercel.app` and redeploy to lock down CORS.

## 2. Deploy the Web app to Vercel
1. In Vercel, import the GitHub repo and choose the `apps/web` directory.
2. Configure environment variables:
   - `NEXT_PUBLIC_API_BASE_URL=https://rag-playground-api.onrender.com`
   - `NEXT_PUBLIC_ANSWER_MODE_DEFAULT` (optional, defaults to grounded).
   - (For Google auth) `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<OAuth client id>`.
3. Deploy and note the public URL.

## 3. Post-deploy smoke tests
- Health check: `curl -sS https://<api>/api/health` (expects `{"status":"ok"}`).
- Run the bundled smoke script:
  ```bash
  ./tools/smoke.sh https://rag-playground-api.onrender.com
  ```
  This verifies upload → index → query against the deployed API.
- Visit the Vercel playground, click **Use sample dataset**, **Build index**, and ask “What is our PTO policy?”. You should see citations and a `Sources: [...]` footer.

## 4. Operational notes
- The API stores session state in memory; redeploys clear uploaded data.
- Reranker availability and configuration can be inspected via:
  ```bash
  curl -sS -X POST https://<api>/api/debug/rerank | jq .
  ```
- Admin-only observability endpoints:
  - `GET https://<api>/api/metrics/summary` – requires an authenticated admin session and reports aggregate counts (resets on deploy/restart).
  - `GET https://<api>/api/health/details` – lightweight health information (always accessible).
- The golden QA regression suite can run locally before deploying:
  ```bash
  cd apps/api
  poetry run pytest -q
  ```
- Cold starts on Render’s free plan add latency to the first request; consider a cron “keep warm” ping if needed.

## 5. Enabling Google Sign-In (after Step F3)
- Set the API envs noted above (`GOOGLE_AUTH_ENABLED=true`, `GOOGLE_CLIENT_ID`, `ADMIN_GOOGLE_EMAIL`, `SESSION_SECRET`).
- Mirror the auth flags in Vercel (`NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`).
- Redeploy both services. When enabled, the playground header exposes a single Google sign-in button. Administrators (matching `ADMIN_GOOGLE_EMAIL`) gain access to the in-app metrics/health dashboard and refresh controls. Non-admin users may upload/query but cannot view admin tooling.
- Metrics are in-memory only; expect them to reset whenever the API restarts.
- QA smoke: run `poetry run pytest tests/test_eval_qa.py -q` from `apps/api/` for a quick quality check before or after deployment.

Refer back to the root README for local development workflows and troubleshooting tips.
