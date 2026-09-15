#!/usr/bin/env bash
# Start Pressroom (if needed) and keep a live trycloudflare hostname in front of it.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${PORT:-43127}"

desk_up() {
  curl -fsS --max-time 3 "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1
}

if ! desk_up; then
  echo "Starting Pressroom on :${PORT}"
  npm run dev >/tmp/pressroom-dev.log 2>&1 &
  echo $! >/tmp/pressroom-dev.pid
  for _ in $(seq 1 90); do
    if desk_up; then
      echo "Pressroom is up."
      break
    fi
    sleep 1
  done
  if ! desk_up; then
    echo "Pressroom failed to start. Last log:" >&2
    tail -n 40 /tmp/pressroom-dev.log >&2 || true
    exit 1
  fi
fi

exec bash "$ROOT/scripts/etsy-tunnel.sh"
