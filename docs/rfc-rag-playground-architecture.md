⸻

RFC: RAG Playground – Production Architecture

Owner: Amlan Das
Status: Implemented (v1)
Last Known Good Prod Baseline: GitHub commit '5c92f7d3bf28ea2027c0b9e3e703ee542e918538' + Cloud Run revisions:
	•	rag-playground-api@rag-playground-api-00045-5dh
	•	rag-playground-web@rag-playground-web-00030-s4q

⸻

1. Goals & Non-Goals

Goals
	1.	Provide a self-contained, production-ready RAG playground with:
	•	Simple RAG and A/B RAG modes
	•	Graph RAG (multi-stage, fact-checked) mode
	2.	Support authenticated, admin-gated access using Google Sign-In.
	3.	Keep configuration explicit and debuggable, with clear separation between:
	•	Secrets → Secret Manager
	•	Infra/network → Cloud Run env vars (via Cloud Build)
	•	RAG tuning & feature flags → Firestore runtime config
	4.	Provide enough structure that this system can be used as a template for other AI playgrounds / RAG apps.

Non-Goals
	•	Multi-tenant authorization (single trusted Google workspace is assumed).
	•	Full enterprise RBAC or project-level ACLs.
	•	Ultra-low-latency / cost-optimized architecture (this is a “serious demo” system, not a multi-region SaaS).

⸻

2. High-Level Architecture

At a high level, the system is:
	•	Frontend: Next.js app (rag-playground-web) deployed as a Cloud Run service.
	•	Backend API: FastAPI app (rag-playground-api) deployed as a Cloud Run service.
	•	External services
	•	OpenAI API (embeddings, completion, LLM ranking, fact checking)
	•	Google Identity Services (GIS) + Google OAuth2 for ID token verification
	•	GCP Firestore (runtime config)
	•	GCP Secret Manager (API keys & sensitive values)
	•	CI/CD: Cloud Build triggers for API + Web, driven by infra/gcp/cloudbuild.api.yaml and infra/gcp/cloudbuild.web.yaml, deploying to Cloud Run.

2.1 Data & Control Flows (Summary)
	1.	User hits Web:
Browser → rag-playground-web → renders landing page and playground.
	2.	Health & connectivity:
Web calls API /api/health and /api/health/details for connectivity + config diagnostics.
	3.	Sign in with Google:
	•	Web loads GIS, gets ID token from Google.
	•	Web POSTs ID token to API /api/auth/google.
	•	API verifies token, issues signed rag_session cookie.
	4.	RAG session:
	•	Authenticated user uploads docs → POST /api/index.
	•	API builds a session-scoped index (simple or graph-augmented).
	•	User runs queries via /api/query (simple/A/B) or /api/query/advanced (Graph RAG).
	5.	Advanced Graph RAG:
	•	Planner decomposes query.
	•	Graph + hybrid retrieval fetches candidates.
	•	LLM summarises sub-queries & synthesises final answer.
	•	Optional CE/LLM rerank and optional fact-checking LLM.
	•	Response includes answer, citations, diagnostics.

⸻

3. Components

3.1 Frontend – rag-playground-web
	•	Framework: Next.js (App Router)
	•	Key modules:
	•	apps/web/app/layout.tsx – global layout + AuthProvider wiring.
	•	apps/web/app/page.tsx – landing page with health badge.
	•	apps/web/app/playground/page.tsx – main playground UI.
	•	apps/web/components/AuthProvider.tsx – auth state, GIS handling.
	•	apps/web/components/HealthBadge.tsx – API reachability.
	•	apps/web/lib/api.ts – getApiBaseUrl(), apiGet helpers.
	•	apps/web/lib/rag-api.ts – typed wrappers for /api/* endpoints.

Responsibilities
	•	Render three modes: Simple, A/B, Graph RAG.
	•	For auth:
	•	Decide if GIS + auth are enabled based on:
	•	NEXT_PUBLIC_GOOGLE_AUTH_ENABLED
	•	NEXT_PUBLIC_GOOGLE_CLIENT_ID
	•	Use AuthProvider to:
	•	Trigger Google sign-in.
	•	Call /api/auth/google and /api/auth/me (with credentials: 'include').
	•	Drive UI gating (upload, Build Index, Run, admin panels).
	•	For RAG:
	•	Wire controls:
	•	Simple / A/B controls (k, chunk size, overlap, temperature).
	•	Graph RAG controls (k, hops, rerank strategy, verification mode).
	•	Display result + comparisons + Graph RAG diagnostics.

Key front-end env vars (Cloud Build build args)
	•	NEXT_PUBLIC_API_BASE_URL
	•	NEXT_PUBLIC_GOOGLE_AUTH_ENABLED
	•	NEXT_PUBLIC_GOOGLE_CLIENT_ID
	•	NEXT_PUBLIC_GRAPH_RAG_ENABLED
	•	NEXT_PUBLIC_LLM_RERANK_ENABLED
	•	NEXT_PUBLIC_FACT_CHECK_LLM_ENABLED

These are build-time and govern what the UI exposes, not how the backend behaves.

⸻

3.2 Backend API – rag-playground-api
	•	Framework: FastAPI
	•	Key modules:
	•	app/main.py – app factory, CORS, routers.
	•	app/config.py – strongly-typed Settings; maps env → config.
	•	app/services/runtime_config.py – env + Firestore-backed feature flags.
	•	app/services/cors.py – origin parsing + CORS config summary.
	•	app/services/session_auth.py – session cookies & auth enforcement.
	•	app/routers/auth.py – /api/auth/google, /api/auth/logout, /api/auth/me.
	•	app/routers/health.py – /api/health, /api/health/details.
	•	app/routers/ingest.py – /api/index for indexing docs & graph building.
	•	app/routers/query.py – /api/query for Simple & A/B.
	•	app/routers/query_advanced.py – /api/query/advanced for Graph RAG.

3.3 Ingestion modes & limits
	•	Legacy in-memory uploads: `/api/upload` reads multipart bodies into memory and persists extracted text in the per-session cache. This path stays active when `GCS_INGESTION_ENABLED=false` (local dev, older environments).
	•	GCS-backed ingestion: when GCS ingestion is enabled, uploads stream directly to GCS and the indexer downloads bytes per document before chunking/embedding. Session prefixes make TTL cleanup easy.
	•	Cloud Run enforces ~32MB request bodies, so we cap uploads at **30MB per file** in the UI to avoid platform 413 errors. Larger uploads will move to a direct-to-GCS signed URL flow so 100MB+ files bypass the Cloud Run proxy entirely.
	•	app/services/advanced.py – Graph RAG pipeline:
	•	Planner, graph traversal, hybrid retrieval.
	•	LLM summarisation + synthesis.
	•	Rerank (CE vs LLM).
	•	Verification (RAG-V vs fact-check LLM).
	•	app/services/observability.py – metrics summary, counters, diagnostics.

Responsibilities
	•	Authentication & sessions
	•	Validate ID tokens against Google using GOOGLE_CLIENT_ID.
	•	Issue/clear rag_session cookie.
	•	Only enforce auth when google_auth_enabled_effective() is true.
	•	CORS + cookies
	•	Build allow_origins from CORS_ALLOWED_ORIGINS or defaults.
	•	Set allow_credentials=True so browser cookies work.
	•	Compute cookie Secure + SameSite from CORS config.
	•	Runtime config
	•	Merge env + Firestore into a single RuntimeConfig:
	•	features.google_auth_enabled
	•	features.graph_enabled
	•	features.llm_rerank_enabled
	•	features.fact_check_llm_enabled
	•	features.fact_check_strict
	•	graph_rag.max_graph_hops
	•	graph_rag.advanced_max_subqueries
	•	graph_rag.advanced_default_k
	•	graph_rag.advanced_default_temperature
	•	Expose metadata via /api/health/details.
	•	RAG
	•	Simple + A/B:
	•	Ingest chunks; embed; store index; CE re-rank.
	•	Graph RAG:
	•	Query → planner → graph traversal + retrieval.
	•	Multi-stage LLM summarisation/synthesis.
	•	Optional re-rank & verification controlled by feature flags.

Key backend env vars
	•	From Cloud Build → Cloud Run:
	•	Infra / core:
	•	EMBEDDINGS_PROVIDER
	•	FIRESTORE_CONFIG_ENABLED
	•	CONFIG_ENV
	•	GOOGLE_AUTH_ENABLED
	•	CORS_ALLOWED_ORIGINS
	•	Secrets (via Secret Manager):
	•	OPENAI_API_KEY
	•	SESSION_SECRET
	•	GOOGLE_CLIENT_ID
	•	GOOGLE_CLIENT_SECRET
	•	ADMIN_GOOGLE_EMAIL

⸻

3.3 Firestore – Runtime Config
	•	Database: default Firestore (native) in us-west1.
	•	Collection: runtime_config
	•	Document (prod): runtime_config/prod

Fields (current structure)

{
  "features": {
    "google_auth_enabled": true,
    "graph_enabled": true,
    "llm_rerank_enabled": true,
    "fact_check_llm_enabled": true,
    "fact_check_strict": false
  },
  "graph_rag": {
    "max_graph_hops": 2,
    "advanced_max_subqueries": 3,
    "advanced_default_k": 6,
    "advanced_default_temperature": 0.2
  }
}

	•	When FIRESTORE_CONFIG_ENABLED=true and CONFIG_ENV=prod, these values override env-derived defaults for feature flags and RAG tuning.
	•	If the document is missing some fields, env defaults are used for those fields.

⸻

3.4 CI/CD
API build: infra/gcp/cloudbuild.api.yaml
	•	Builds & pushes rag-playground-api image.
	•	Deploys to Cloud Run with:
	•	--set-env-vars=... for:
	•	EMBEDDINGS_PROVIDER
	•	FIRESTORE_CONFIG_ENABLED
	•	CONFIG_ENV
	•	GOOGLE_AUTH_ENABLED
	•	CORS_ALLOWED_ORIGINS
	•	--set-secrets=... for all secrets.
	•	Reads values from Cloud Build trigger substitutions; that is the single source of truth for non-secret env configuration.

Web build: infra/gcp/cloudbuild.web.yaml
	•	Builds rag-playground-web image with --build-arg for all NEXT_PUBLIC_* values.
	•	Deploys to Cloud Run with simple infra env vars (port, CPU, memory, etc).

⸻

4. Observability & Debugging
	•	GET /api/health
Returns simple { status: "ok" } for health checks.
	•	GET /api/health/details
Returns a rich diagnostic object:
	•	Auth flags (google_auth_enabled, google_auth_effective)
	•	RAG flags (graph_enabled, advanced_graph_enabled, etc.)
	•	CORS config (cors_allowed_origins, cors_config_source)
	•	Runtime config metadata (Firestone vs env, config_env)
	•	Cloud Run logs:
	•	Startup logs print CORS config + key feature flags.
	•	Web UI:
	•	Landing page shows “API: healthy / error”.
	•	Playground “Auth diagnostics” + “API diagnostics” panels mirror backend health details.

⸻

5. Known Good Baseline & Tenets

Known good baseline
	•	Google auth works end-to-end.
	•	CORS is correctly configured with all prod web origins.
	•	Firestore runtime config is enabled and controlling Graph RAG feature flags.
	•	Simple, A/B, and Graph RAG (with fact-check) all function correctly.

Tenets
	1.	Clear separation of concerns
	•	Secrets → Secret Manager.
	•	Network/infra → Cloud Run env from Cloud Build.
	•	RAG tuning + feature flags → Firestore runtime config.
	2.	No duplicate configuration
	•	There is a single source of truth for each concept.
	3.	Self-diagnosable
	•	/api/health/details must always be sufficient to answer:
	•	“Is auth on?”
	•	“Is Graph RAG on?”
	•	“Which config layer is in control?”
