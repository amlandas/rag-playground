#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

IMAGE_NAME="rag-playground-web:local"
API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-http://localhost:8000}"
AUTH_ENABLED="${NEXT_PUBLIC_GOOGLE_AUTH_ENABLED:-false}"
CLIENT_ID="${NEXT_PUBLIC_GOOGLE_CLIENT_ID:-}"
PORT="${PORT:-3000}"

echo "Building ${IMAGE_NAME}"
docker build \
  --build-arg "NEXT_PUBLIC_API_BASE_URL=${API_BASE_URL}" \
  --build-arg "NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=${AUTH_ENABLED}" \
  --build-arg "NEXT_PUBLIC_GOOGLE_CLIENT_ID=${CLIENT_ID}" \
  -f "${REPO_ROOT}/apps/web/Dockerfile" \
  -t "${IMAGE_NAME}" \
  "${REPO_ROOT}"

echo "Starting container on http://localhost:${PORT}"
docker run --rm -p "${PORT}:${PORT}" \
  -e PORT="${PORT}" \
  "${IMAGE_NAME}"
