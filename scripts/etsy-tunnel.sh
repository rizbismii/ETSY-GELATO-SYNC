#!/usr/bin/env bash
# Expose the local desk as https://*.trycloudflare.com so Etsy can store a .com Callback URL.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="${HOME}/.local/bin/cloudflared"
PORT="${PORT:-43127}"
mkdir -p "$(dirname "$BIN")" "$ROOT/data"

if [[ ! -x "$BIN" ]]; then
  echo "Downloading cloudflared…"
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" -o "$BIN"
  chmod +x "$BIN"
fi

echo "Opening a .com HTTPS tunnel to http://127.0.0.1:${PORT}"
echo "Paste the Callback URL Etsy shows into fernora-etsgelto-app, then Authorize with Etsy."

wrote=""
"$BIN" tunnel --url "http://127.0.0.1:${PORT}" --no-autoupdate 2>&1 | while IFS= read -r line; do
  echo "$line"
  if [[ "$line" =~ (https://[a-zA-Z0-9.-]+\.trycloudflare\.com) ]]; then
    origin="${BASH_REMATCH[1]}"
    if [[ "$wrote" != "$origin" ]]; then
      wrote="$origin"
      python3 - "$ROOT/data/public-origin.json" "$origin" <<'PY'
import json, sys
from pathlib import Path
path = Path(sys.argv[1])
origin = sys.argv[2].rstrip("/")
path.write_text(json.dumps({"origin": origin}, indent=2) + "\n")
print(f"\nEtsy website URL:  {origin}", flush=True)
print(f"Etsy Callback URL: {origin}/api/etsy/callback\n", flush=True)
PY
    fi
  fi
done
