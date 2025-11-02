# Deployment Guide

This repo deploys as:
- **Web (Next.js/Tailwind)** → Vercel
- **API (FastAPI + FAISS)** → Render (Docker)

## Prereqs
- GitHub repository with this code
- Vercel account connected to GitHub
- Render account connected to GitHub
- OpenAI API key

## 1) Deploy API to Render
1. Push the repo to GitHub.
2. In Render, click **New + → Blueprint** and select this repo.
3. Choose `apps/api/render.yaml` as the blueprint.
4. Set the environment variable **OPENAI_API_KEY** (required). You can override other limits later.
5. Deploy and copy the resulting base URL, e.g. `https://rag-playground-api.onrender.com`.

> After the first deploy, set `ALLOW_ORIGINS` to your Vercel URL to tighten CORS.

## 2) Deploy Web to Vercel
1. Import the repo in Vercel and select the `apps/web` directory as the project root.
2. In Environment Variables add `NEXT_PUBLIC_API_BASE_URL` with the Render API URL (for example `https://rag-playground-api.onrender.com`).
3. Deploy and note the public URL, e.g. `https://rag-playground.vercel.app`.

## 3) Lock Down CORS
- In Render → API service → Environment add `ALLOW_ORIGINS=https://rag-playground.vercel.app` and redeploy.

## 4) Smoke Test
- Visit the Vercel site → landing page loads.
- Go to **Playground**:
  - Click **Use sample dataset** → **Build index** → Ask “What is our PTO policy?”
  - Sources appear before the streamed answer.
- Optional: switch to **Advanced (A/B)** and run a comparison.

## 5) Operational Notes
- All state is in-memory; restarting the API clears sessions.
- Adjust per-session limits via Render env (`MAX_*`, `MIN_RETRIEVAL_SIMILARITY`).
- Free Render instances can cold-start; first request may be slower.

## 6) CLI Smoke Commands

```bash
# Health
curl -sS https://<your-api>/api/health

# Upload sample text file
curl -sS -F "files=@apps/web/public/samples/policy.txt" https://<your-api>/api/upload

# Index (replace <sid>)
curl -sS -H 'Content-Type: application/json' \
  -d '{"session_id":"<sid>","chunk_size":800,"overlap":120}' \
  https://<your-api>/api/index

# Query (SSE stream)
curl -N -H 'Content-Type: application/json' \
  -d '{"session_id":"<sid>","query":"What is our PTO policy?"}' \
  https://<your-api>/api/query
```
