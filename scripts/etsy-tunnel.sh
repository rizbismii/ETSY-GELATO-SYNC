#!/usr/bin/env bash
# Keep an https://*.trycloudflare.com hostname in front of the local desk.
# Quick tunnels die; this process replaces a dead one and rewrites data/public-origin.json.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="${HOME}/.local/bin/cloudflared"
PORT="${PORT:-43127}"
LOG="${TMPDIR:-/tmp}/cloudflared-etsy.log"
PIDFILE="${TMPDIR:-/tmp}/cloudflared-etsy.pid"
ORIGIN_FILE="$ROOT/data/public-origin.json"

mkdir -p "$(dirname "$BIN")" "$ROOT/data"

if [[ ! -x "$BIN" ]]; then
  echo "Downloading cloudflared…"
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" -o "$BIN"
  chmod +x "$BIN"
fi

write_origin() {
  local origin="$1"
  python3 - "$ORIGIN_FILE" "$origin" <<'PY'
import json, sys
from pathlib import Path
path = Path(sys.argv[1])
origin = sys.argv[2].rstrip("/")
path.write_text(json.dumps({"origin": origin}, indent=2) + "\n")
print(f"Etsy website URL:  {origin}", flush=True)
print(f"Etsy Callback URL: {origin}/api/etsy/callback", flush=True)
PY
}

extract_origin() {
  grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$LOG" 2>/dev/null | tail -1 || true
}

stop_tunnel() {
  if [[ -f "$PIDFILE" ]]; then
    kill "$(cat "$PIDFILE")" 2>/dev/null || true
    rm -f "$PIDFILE"
  fi
  pkill -f "cloudflared tunnel --url http://127.0.0.1:${PORT}" 2>/dev/null || true
}

health_ok() {
  local origin="$1"
  curl -fsS --max-time 8 "${origin}/api/health" >/dev/null 2>&1
}

trap stop_tunnel EXIT

echo "Opening a .com HTTPS tunnel to http://127.0.0.1:${PORT}"
echo "Replace the Callback URL in fernora-etsgelto-app whenever this hostname changes."

while true; do
  stop_tunnel
  : > "$LOG"
  "$BIN" tunnel --url "http://127.0.0.1:${PORT}" --no-autoupdate --protocol http2 --edge-ip-version 4 \
    >>"$LOG" 2>&1 &
  echo $! > "$PIDFILE"

  origin=""
  for _ in $(seq 1 45); do
    origin="$(extract_origin)"
    if [[ -n "$origin" ]]; then
      write_origin "$origin"
      break
    fi
    if ! kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
      echo "cloudflared exited before publishing a hostname" >&2
      tail -n 20 "$LOG" >&2 || true
      break
    fi
    sleep 1
  done

  if [[ -z "$origin" ]]; then
    sleep 3
    continue
  fi

  up=0
  for _ in $(seq 1 15); do
    if health_ok "$origin"; then
      up=1
      echo "Public callback is reachable."
      break
    fi
    sleep 2
  done
  if [[ "$up" != 1 ]]; then
    echo "New hostname did not become reachable. Retrying…"
    continue
  fi

  while kill -0 "$(cat "$PIDFILE")" 2>/dev/null; do
    if grep -q "Tunnel not found" "$LOG" 2>/dev/null; then
      echo "Cloudflare recycled the tunnel. Starting a new .com hostname…"
      break
    fi
    if ! health_ok "$origin"; then
      echo "Public callback is not reachable. Starting a new .com hostname…"
      break
    fi
    sleep 20
  done
  stop_tunnel
  sleep 2
done
