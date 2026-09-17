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
data = {}
if path.exists():
    try:
        data = json.loads(path.read_text())
    except Exception:
        data = {}
if not isinstance(data, dict):
    data = {}
if data.get("origin") != origin:
    data["tunnel"] = {}
data["origin"] = origin
path.write_text(json.dumps(data, indent=2) + "\n")
PY
  echo "Etsy website URL:  ${origin}"
  echo "Etsy Callback URL: ${origin}/api/etsy/callback"
}

push_origin() {
  local origin="$1"
  if curl -fsS --max-time 25 -X POST "http://127.0.0.1:${PORT}/api/connections/tunnel" \
    -H "Content-Type: application/json" \
    -d '{"platform":"all"}' >/tmp/pressroom-tunnel-push.json; then
    echo "Pushed ${origin} to Etsy / Shopify / Gelato. Paste Website + Callback into fernora-etsgelto-app, then Authorize with Etsy."
  else
    echo "Could not auto-push ${origin}; use Push this tunnel to all three on Connections."
  fi
}

extract_origin() {
  grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare.com' "$LOG" 2>/dev/null | tail -1 || true
}

stop_tunnel() {
  if [[ -f "$PIDFILE" ]]; then
    kill "$(cat "$PIDFILE")" 2>/dev/null || true
    rm -f "$PIDFILE"
  fi
  pkill -f "cloudflared tunnel --url http://127.0.0.1:${PORT}" 2>/dev/null || true
}

local_ready() {
  curl -fsS --max-time 5 "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1
}

tunnel_registered() {
  grep -q "Registered tunnel connection" "$LOG" 2>/dev/null && ! grep -q "Tunnel not found" "$LOG" 2>/dev/null
}

public_probe() {
  local origin="$1"
  local host="${origin#https://}"
  host="${host%%/*}"
  local ip
  ip="$(dig +short @1.1.1.1 "$host" A | head -1 || true)"
  if [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    if curl -fsS --max-time 8 --resolve "${host}:443:${ip}" "${origin}/api/health" >/dev/null 2>&1; then
      return 0
    fi
  fi
  curl -fsS --max-time 10 "${origin}/api/health" >/dev/null 2>&1
}

wait_for_desk() {
  if local_ready; then
    return 0
  fi
  echo "Waiting for Pressroom on http://127.0.0.1:${PORT} …"
  local i
  for i in $(seq 1 90); do
    if local_ready; then
      echo "Pressroom is up."
      return 0
    fi
    sleep 2
  done
  echo "Pressroom did not start on :${PORT}" >&2
  return 1
}

trap stop_tunnel EXIT

echo "Opening a .com HTTPS tunnel to http://127.0.0.1:${PORT}"
echo "Replace the Callback URL in fernora-etsgelto-app whenever this hostname changes."

while true; do
  wait_for_desk || { sleep 5; continue; }
  stop_tunnel
  : > "$LOG"
  "$BIN" tunnel --url "http://127.0.0.1:${PORT}" --no-autoupdate --protocol http2 --edge-ip-version 4 >>"$LOG" 2>&1 &
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
  for _ in $(seq 1 30); do
    if local_ready && tunnel_registered; then
      up=1
      echo "Tunnel is registered with Cloudflare."
      if public_probe "$origin"; then
        echo "Public callback is reachable from 1.1.1.1."
        push_origin "$origin"
      else
        echo "Public DNS from this VM is delayed; keep the hostname anyway for Etsy/your browser."
        push_origin "$origin"
      fi
      break
    fi
    sleep 2
  done
  if [[ "$up" != 1 ]]; then
    echo "Tunnel did not register. Retrying…"
    continue
  fi

  fails=0
  born=$SECONDS
  while kill -0 "$(cat "$PIDFILE")" 2>/dev/null; do
    if grep -q "Tunnel not found" "$LOG" 2>/dev/null || grep -q "Unable to reach the origin service" "$LOG" 2>/dev/null; then
      echo "Cloudflare recycled the tunnel or lost the origin. Starting a new .com hostname…"
      break
    fi
    if ! local_ready; then
      echo "Local desk is down. Waiting…"
      fails=0
      sleep 5
      continue
    fi
    if public_probe "$origin"; then
      fails=0
    else
      if (( SECONDS - born < 90 )); then
        echo "Public DNS still settling for ${origin}…"
      else
        fails=$((fails + 1))
        echo "Public tunnel probe failed (${fails}/6)."
        if [[ "$fails" -ge 6 ]]; then
          echo "Tunnel is not live. Opening a new hostname…"
          break
        fi
      fi
    fi
    sleep 15
  done
  stop_tunnel
  sleep 2
done
