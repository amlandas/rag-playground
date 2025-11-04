#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.."; pwd)"
cd "$ROOT"

mkdir -p "$ROOT/logs" "$ROOT/.local/run"

LOG_API="$ROOT/logs/api.log"
LOG_WEB="$ROOT/logs/web.log"
PID_API="$ROOT/.local/run/api.pid"
PID_WEB="$ROOT/.local/run/web.pid"

# Ensure local development relies on .env, not ambient shell overrides
unset RERANK_STRATEGY RERANK__STRATEGY RAG_RERANK_STRATEGY

if [ -z "${OPENAI_API_KEY:-}" ] || [ -z "${EMBEDDINGS_PROVIDER:-}" ]; then
  if [ -f "$ROOT/apps/api/.env" ]; then
    echo "Loading API environment from apps/api/.env"
    set -a; source "$ROOT/apps/api/.env"; set +a
    for VAR_NAME in RERANK_STRATEGY RERANK__STRATEGY RAG_RERANK_STRATEGY RERANK_STRICT; do
      if [ -n "${!VAR_NAME:-}" ]; then
        export "$VAR_NAME"
      fi
    done
  fi
fi

PROVIDER="${EMBEDDINGS_PROVIDER:-openai}"
if [ "$PROVIDER" = "fake" ]; then
  echo "Using fake embeddings provider (no external embedding API calls)."
elif [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "[WARN] OPENAI_API_KEY is not set. The API may fail when embeddings are required."
fi

bash "$ROOT/tools/stop_local.sh" || true

echo "Starting API on :8000 ..."
(
  cd apps/api && \
  export ALLOW_ORIGINS="http://localhost:3000,http://localhost:3001" && \
  poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
) >"$LOG_API" 2>&1 &
echo $! > "$PID_API"
sleep 1

printf "Waiting for API health "
HEALTH_OK=0
for ((elapsed=1; elapsed<=60; elapsed++)); do
  if curl -fsS http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
    HEALTH_OK=1
    printf "OK (%ss)\n" "$elapsed"
    break
  fi
  printf "."
  sleep 1
done

if [ $HEALTH_OK -ne 1 ]; then
  echo
  echo "[ERROR] API health timed out after 60s"
  if [ -f "$LOG_API" ]; then
    echo "----- tail logs/api.log (last 200 lines) -----"
    tail -n 200 "$LOG_API"
    echo "---------------------------------------------"
  else
    echo "logs/api.log not found."
  fi
  echo "Hint: cd apps/api && source .env 2>/dev/null || true && poetry run uvicorn app.main:app --reload --port 8000 --log-level debug"
  EXIT_PID_API=$(cat "$PID_API" 2>/dev/null || true)
  if [ -n "${EXIT_PID_API:-}" ]; then
    kill "$EXIT_PID_API" >/dev/null 2>&1 || true
  fi
  exit 1
fi

ENV_SNAPSHOT=$(curl -fsS -X POST http://127.0.0.1:8000/api/debug/env 2>/dev/null || true)
if [ -n "$ENV_SNAPSHOT" ]; then
  echo "== /api/debug/env =="
  python3 - "$ENV_SNAPSHOT" <<'PY'
import json, sys
payload = sys.argv[1]
try:
    data = json.loads(payload)
except json.JSONDecodeError as exc:
    print(f"[WARN] invalid JSON from /api/debug/env: {exc}")
    raise SystemExit(0)
print(json.dumps(data, indent=2, sort_keys=True))
strategy = data.get("strategy_effective") or data.get("settings", {}).get("RERANK_STRATEGY")
if strategy is not None:
    print(f"Effective rerank strategy: {strategy}")
PY
else
  echo "[WARN] Failed to fetch /api/debug/env snapshot."
fi

WEB_PORT=3000
if lsof -i :3000 >/dev/null 2>&1; then
  WEB_PORT=3001
fi
echo "Starting Web on :$WEB_PORT ..."
(
  cd apps/web && pnpm install >/dev/null 2>&1 || true; pnpm exec next dev -p "$WEB_PORT"
) >"$LOG_WEB" 2>&1 &
echo $! > "$PID_WEB"
sleep 2

echo "------------------------------------------------------------"
echo "API   : http://localhost:8000   (logs: $LOG_API)"
echo "Web   : http://localhost:$WEB_PORT (logs: $LOG_WEB)"
echo "Stop  : ./tools/stop_local.sh"
echo "------------------------------------------------------------"

if [ "${GOOGLE_AUTH_ENABLED:-false}" = "true" ]; then
  echo "[SKIP] GOOGLE_AUTH_ENABLED=true; skipping automated smoke tests that require authentication."
  exit 0
fi

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "[SKIP] OPENAI_API_KEY not set; skipping automated smoke tests."
  exit 0
fi

echo "Running smoke tests..."
set +e
HEALTH=$(curl -fsS http://localhost:8000/api/health 2>/dev/null)
RC=$?
set -e
if [ $RC -ne 0 ]; then
  echo "❌ API health failed"; exit 1
fi
echo "✅ API health: $HEALTH"

SAMPLE="$ROOT/apps/web/public/samples/policy.txt"
if [ ! -f "$SAMPLE" ]; then
  echo "ERROR: sample file not found at $SAMPLE"; exit 1
fi

SID=$(curl -fsS -F "files=@$SAMPLE" http://localhost:8000/api/upload | python3 -c 'import sys,json; print(json.load(sys.stdin)["session_id"])')
echo "✅ Upload OK. session_id=$SID"

INDEX_RES=$(curl -fsS -H 'Content-Type: application/json' \
  -d "{\"session_id\":\"$SID\",\"chunk_size\":800,\"overlap\":120}" \
  http://localhost:8000/api/index)
echo "✅ Index OK. Response: $INDEX_RES"

RETRIEVE=$(curl -fsS -X POST -H 'Content-Type: application/json' \
  -d "{\"session_id\":\"$SID\",\"query\":\"What is our PTO policy?\",\"k\":8}" \
  http://localhost:8000/api/debug/retrieve)
echo "ℹ️ Retrieve debug: $RETRIEVE"

echo "------------------------------------------------------------"
echo "Local E2E smoke passed. Open:"
echo "  http://localhost:$WEB_PORT/playground"
echo "Then: Use sample dataset → Build index → Ask a question."
echo "If the UI shows errors, tail logs:"
echo "  tail -f $LOG_API"
echo "  tail -f $LOG_WEB"
echo "Stop both with:"
echo "  ./tools/stop_local.sh"
echo "------------------------------------------------------------"
