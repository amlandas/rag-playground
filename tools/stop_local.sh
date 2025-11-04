#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
for name in api web; do
  if [ -f ".local/run/$name.pid" ]; then
    PID=$(cat ".local/run/$name.pid" || true)
    if [ -n "${PID:-}" ] && ps -p "$PID" >/dev/null 2>&1; then
      echo "Stopping $name (PID $PID)..."
      kill "$PID" || true
      sleep 1
      ps -p "$PID" >/dev/null 2>&1 && kill -9 "$PID" || true
    fi
    rm -f ".local/run/$name.pid"
  fi
done

# Kill any stray processes still bound to dev ports
for port in 8000 3000 3001; do
  PIDS=$(lsof -ti :$port 2>/dev/null | tr '\n' ' ')
  if [ -n "${PIDS// /}" ]; then
    echo "Killing processes on port $port: $PIDS"
    kill $PIDS >/dev/null 2>&1 || true
  fi
done

echo "Stopped (if running). Logs in ./logs/"
