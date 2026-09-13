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
  python3 -c 'import json,sys; from pathlib import Path; Path(sys.argv[1]).write_text(json.dumps({"origin": sys.argv[2].rstrip("/")}, indent=2)+"\n")' "$ORIGIN_FILE" "$origin"
  echo "Etsy website URL:  ${origin}"
  echo "Etsy Callback URL: ${origin}/api/etsy/callback"
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
  if [[ ! "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    return 1
  fi
  curl -fsS --max-time 8 --resolve "${host}:443:${ip}" "${origin}/api/health" >/dev/null 2>&1
}

trap stop_tunnel EXIT

echo "Opening a .com HTTPS tunnel to http://127.0.0.1:${PORT}"
echo "Replace the Callback URL in fernora-etsgelto-app whenever this hostname changes."

while true; do
  stop_tunnel
  : > "$LOG"
  "$BIN" tunnel --url "http://127.0.0.1:${PORT}" --no-autoupdate >>"$LOG" 2>&1 &
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
      else
        echo "Public DNS from this VM is delayed; keep the hostname anyway for Etsy/your browser."
      fi
      break
    fi
    sleep 2
  done
  if [[ "$up" != 1 ]]; then
    echo "Tunnel did not register. Retrying…"
    continue
  fi

  while kill -0 "$(cat "$PIDFILE")" 2>/dev/null; do
    if grep -q "Tunnel not found" "$LOG" 2>/dev/null; then
      echo "Cloudflare recycled the tunnel. Starting a new .com hostname…"
      break
    fi
    if ! local_ready; then
      echo "Local desk is down. Waiting…"
    fi
    sleep 20
  done
  stop_tunnel
  sleep 2
done
