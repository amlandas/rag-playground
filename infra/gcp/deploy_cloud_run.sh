#!/usr/bin/env bash

# Helper to build and deploy the FastAPI service to Cloud Run using Cloud Build.
# Run with `--help` to see usage instructions.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  export PROJECT_ID="your-gcp-project"
  export REGION="us-west1"
  export SERVICE_NAME="rag-playground-api"
  export REPO_NAME="rag-playground"

  export EMBEDDINGS_PROVIDER="openai"
  export OPENAI_API_KEY="sk-..."
  export SESSION_SECRET="..."
  export GOOGLE_AUTH_ENABLED="false"
  export CORS_ALLOWED_ORIGINS="https://your-frontend.example.com"
  # When GOOGLE_AUTH_ENABLED=true also export:
  #   GOOGLE_CLIENT_ID, ADMIN_GOOGLE_EMAIL

  ./infra/gcp/deploy_cloud_run.sh

Optional flags: -h | --help

Environment variables:
  PROJECT_ID            (required) Google Cloud project id.
  REGION                (default: us-west1) Cloud Run & Artifact Registry region.
  SERVICE_NAME          (default: rag-playground-api) Cloud Run service name.
  REPO_NAME             (default: rag-playground) Artifact Registry repo name.
  EMBEDDINGS_PROVIDER   (required) e.g. openai or fake.
  OPENAI_API_KEY        (required) API key unless provider=fake.
  SESSION_SECRET        (required) Strong secret for session signing.
  GOOGLE_AUTH_ENABLED   (required) true or false.
  CORS_ALLOWED_ORIGINS  (required) Comma-separated list of allowed origins.
  GOOGLE_CLIENT_ID      (required when GOOGLE_AUTH_ENABLED=true)
  ADMIN_GOOGLE_EMAIL    (required when GOOGLE_AUTH_ENABLED=true)
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "Error: gcloud CLI is not installed. Install it from https://cloud.google.com/sdk/docs/install" >&2
  exit 1
fi

PROJECT_ID="${PROJECT_ID:-}"
if [[ -z "${PROJECT_ID}" ]]; then
  echo "Error: PROJECT_ID environment variable is required." >&2
  usage
  exit 1
fi

REGION="${REGION:-us-west1}"
SERVICE_NAME="${SERVICE_NAME:-rag-playground-api}"
REPO_NAME="${REPO_NAME:-rag-playground}"
IMAGE_TAG="$(date +%Y%m%d%H%M%S)"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:${IMAGE_TAG}"

REQUIRED_VARS=(EMBEDDINGS_PROVIDER OPENAI_API_KEY SESSION_SECRET GOOGLE_AUTH_ENABLED CORS_ALLOWED_ORIGINS)
MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    MISSING_VARS+=("${var}")
  fi
done

if [[ "${GOOGLE_AUTH_ENABLED,,}" == "true" ]]; then
  AUTH_VARS=(GOOGLE_CLIENT_ID ADMIN_GOOGLE_EMAIL)
  for var in "${AUTH_VARS[@]}"; do
    if [[ -z "${!var:-}" ]]; then
      MISSING_VARS+=("${var}")
    fi
  done
fi

if (( ${#MISSING_VARS[@]} > 0 )); then
  echo "Error: missing required environment variables: ${MISSING_VARS[*]}" >&2
  exit 1
fi

ACTIVE_ACCOUNT="$(gcloud auth list --filter='status=ACTIVE' --format='value(account)' 2>/dev/null || true)"
if [[ -z "${ACTIVE_ACCOUNT}" ]]; then
  echo "Error: no active gcloud account. Run 'gcloud auth login' first." >&2
  exit 1
fi

CONFIGURED_PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
if [[ "${CONFIGURED_PROJECT}" != "${PROJECT_ID}" ]]; then
  echo "Setting gcloud project to ${PROJECT_ID}"
  gcloud config set project "${PROJECT_ID}" >/dev/null
fi

echo "Ensuring Artifact Registry repository ${REPO_NAME} exists in ${REGION}"
if ! gcloud artifacts repositories describe "${REPO_NAME}" --location="${REGION}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPO_NAME}" \
    --location="${REGION}" \
    --repository-format=docker \
    --description="Container images for ${SERVICE_NAME}" >/dev/null
fi

# Normalize comma-separated origins (strip brackets/quotes/whitespace).
TRIMMED_CORS="$(printf '%s' "${CORS_ALLOWED_ORIGINS}" \
  | sed -e 's/[][{}]//g' -e 's/[[:space:]]//g' -e "s/['\"]//g" )"
if [[ -z "${TRIMMED_CORS}" ]]; then
  echo "Error: CORS_ALLOWED_ORIGINS normalized to empty string." >&2
  exit 1
fi

ENV_VARS=(
  "EMBEDDINGS_PROVIDER=${EMBEDDINGS_PROVIDER}"
  "OPENAI_API_KEY=${OPENAI_API_KEY}"
  "SESSION_SECRET=${SESSION_SECRET}"
  "GOOGLE_AUTH_ENABLED=${GOOGLE_AUTH_ENABLED}"
  "CORS_ALLOWED_ORIGINS=${TRIMMED_CORS}"
)

if [[ -n "${GOOGLE_CLIENT_ID:-}" ]]; then
  ENV_VARS+=("GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}")
fi
if [[ -n "${ADMIN_GOOGLE_EMAIL:-}" ]]; then
  ENV_VARS+=("ADMIN_GOOGLE_EMAIL=${ADMIN_GOOGLE_EMAIL}")
fi

ENV_FLAG_ARGS=()
for env_kv in "${ENV_VARS[@]}"; do
  ENV_FLAG_ARGS+=("--set-env-vars=${env_kv}")
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "Building image with Cloud Build: ${IMAGE}"
gcloud builds submit "${REPO_ROOT}" --tag "${IMAGE}"

echo "Deploying ${SERVICE_NAME} to Cloud Run in ${REGION}"
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  "${ENV_FLAG_ARGS[@]}"

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format='value(status.url)')"

echo "Deployment complete. Cloud Run URL:"
echo "  ${SERVICE_URL}"
