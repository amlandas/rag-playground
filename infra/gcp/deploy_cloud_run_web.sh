#!/usr/bin/env bash

set -euo pipefail

to_lower() {
  printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]'
}

usage() {
  cat <<'EOF'
Usage:
  export PROJECT_ID="your-gcp-project"
  export REGION="us-west1"
  export SERVICE_NAME_WEB="rag-playground-web"
  export REPO_NAME="rag-playground"

  export API_BASE_URL="https://rag-playground-api-xxxx.a.run.app"
  export NEXT_PUBLIC_GOOGLE_AUTH_ENABLED="false"
  # When auth is enabled, also set:
  # export NEXT_PUBLIC_GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"

  ./infra/gcp/deploy_cloud_run_web.sh

Environment variables:
  PROJECT_ID                     (required) Google Cloud project id.
  REGION                         (default: us-west1) Deployment region.
  SERVICE_NAME_WEB               (default: rag-playground-web) Cloud Run service for the web.
  REPO_NAME                      (default: rag-playground) Artifact Registry repository.
  API_BASE_URL                   (required) URL of the deployed API service.
  NEXT_PUBLIC_GOOGLE_AUTH_ENABLED(required) "true" or "false".
  NEXT_PUBLIC_GOOGLE_CLIENT_ID   (optional) Required when auth is enabled.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "Error: gcloud CLI not found. Install from https://cloud.google.com/sdk/docs/install" >&2
  exit 1
fi

PROJECT_ID="${PROJECT_ID:-}"
if [[ -z "${PROJECT_ID}" ]]; then
  echo "Error: PROJECT_ID is required." >&2
  usage
  exit 1
fi

REGION="${REGION:-us-west1}"
SERVICE_NAME_WEB="${SERVICE_NAME_WEB:-rag-playground-web}"
REPO_NAME="${REPO_NAME:-rag-playground}"
API_BASE_URL="${API_BASE_URL:-}"
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED="${NEXT_PUBLIC_GOOGLE_AUTH_ENABLED:-}"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="${NEXT_PUBLIC_GOOGLE_CLIENT_ID:-}"

if [[ -z "${API_BASE_URL}" ]]; then
  echo "Error: API_BASE_URL is required." >&2
  exit 1
fi

if [[ -z "${NEXT_PUBLIC_GOOGLE_AUTH_ENABLED}" ]]; then
  echo "Error: NEXT_PUBLIC_GOOGLE_AUTH_ENABLED is required (true/false)." >&2
  exit 1
fi

AUTH_FLAG="$(to_lower "${NEXT_PUBLIC_GOOGLE_AUTH_ENABLED:-}")"
if [ "${AUTH_FLAG}" = "true" ] && [ -z "${NEXT_PUBLIC_GOOGLE_CLIENT_ID:-}" ]; then
  echo "Error: NEXT_PUBLIC_GOOGLE_CLIENT_ID must be set when NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true." >&2
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

IMAGE_TAG="$(date +%Y%m%d%H%M%S)"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME_WEB}:${IMAGE_TAG}"

echo "Ensuring Artifact Registry repo ${REPO_NAME} exists in ${REGION}"
if ! gcloud artifacts repositories describe "${REPO_NAME}" --location="${REGION}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPO_NAME}" \
    --location="${REGION}" \
    --repository-format=docker \
    --description="Container images for rag-playground web" >/dev/null
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# gcloud substitutions cannot safely handle bash array joins on macOS's older bash,
# so build the string manually (always include every key, even if the value is empty).
SUBSTITUTIONS_ARG="_API_BASE_URL=${API_BASE_URL},_NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=${NEXT_PUBLIC_GOOGLE_AUTH_ENABLED},_NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID},_IMAGE=${IMAGE}"

echo "Building web image with Cloud Build using cloudbuild.web.yaml"
gcloud builds submit "${REPO_ROOT}" \
  --config="${REPO_ROOT}/infra/gcp/cloudbuild.web.yaml" \
  --substitutions="${SUBSTITUTIONS_ARG}"

echo "Deploying ${SERVICE_NAME_WEB} to Cloud Run in ${REGION}"
gcloud run deploy "${SERVICE_NAME_WEB}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME_WEB}" --region "${REGION}" --format='value(status.url)')"

echo "Deployment complete. Web Cloud Run URL:"
echo "  ${SERVICE_URL}"
