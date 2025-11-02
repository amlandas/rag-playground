#!/usr/bin/env bash
set -euo pipefail
API_BASE="${1:-http://localhost:8000}"

echo "== Health =="
curl -fsS "$API_BASE/api/health" && echo

echo "== Upload sample =="
SID=$(curl -fsS -F "files=@apps/web/public/samples/policy.txt" "$API_BASE/api/upload" | jq -r .session_id)
echo "session: $SID"

echo "== Index =="
curl -fsS -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SID\",\"chunk_size\":800,\"overlap\":120}" \
  "$API_BASE/api/index" && echo

echo "== Query (SSE preview) =="
curl -N -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SID\",\"query\":\"What is our PTO policy?\"}" \
  "$API_BASE/api/query" | head -n 20
