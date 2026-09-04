#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
#
# Optional real-browser IndexedDB smoke. No extra npm packages.
# Uses Firefox if present. Chromium is not required and is not installed here.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if ! command -v firefox >/dev/null 2>&1; then
  echo "W4_SMOKE_SKIP: firefox not found"
  exit 2
fi

PORT="${W4_SMOKE_PORT:-0}"
REPORT="$(mktemp)"
PROFILE="$(mktemp -d)"
PORTFILE="$(mktemp)"
SERVER_PID=""
FF_PID=""
trap 'kill $SERVER_PID $FF_PID 2>/dev/null || true; rm -rf "$PROFILE"' EXIT

python3 - "$PORT" "$REPORT" "$ROOT" "$PORTFILE" <<'PY' &
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

wanted = int(sys.argv[1])
report = Path(sys.argv[2])
root = Path(sys.argv[3])
portfile = Path(sys.argv[4])

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root), **kwargs)

    def do_POST(self):
        if self.path != '/__w4_report':
            self.send_error(404)
            return
        n = int(self.headers.get('Content-Length', '0'))
        body = self.rfile.read(n)
        report.write_bytes(body)
        self.send_response(204)
        self.end_headers()

    def log_message(self, fmt, *args):
        return

httpd = ThreadingHTTPServer(('127.0.0.1', wanted), Handler)
portfile.write_text(str(httpd.server_address[1]), encoding='utf-8')
httpd.serve_forever()
PY
SERVER_PID=$!
for _ in $(seq 1 20); do
  if [[ -s "$PORTFILE" ]]; then
    PORT="$(cat "$PORTFILE")"
    break
  fi
  sleep 0.1
done
if [[ -z "${PORT}" || "$PORT" == 0 ]]; then
  echo "W4_SMOKE_SKIP: local server did not bind"
  exit 2
fi

firefox --headless --no-remote --profile "$PROFILE" \
  "http://127.0.0.1:${PORT}/js/tests/w4-browser-smoke.html" >/tmp/w4-ff.out 2>/tmp/w4-ff.err &
FF_PID=$!

for _ in $(seq 1 60); do
  if [[ -s "$REPORT" ]]; then
    kill "$FF_PID" 2>/dev/null || true
    python3 - "$REPORT" <<'PY'
import json, sys
data = json.loads(open(sys.argv[1], encoding='utf-8').read())
print(json.dumps(data, indent=2, sort_keys=True))
sys.exit(0 if data.get('ok') else 1)
PY
    exit $?
  fi
  sleep 0.5
done

kill "$FF_PID" 2>/dev/null || true
echo "W4_SMOKE_TIMEOUT"
echo "--- firefox stdout ---"
cat /tmp/w4-ff.out 2>/dev/null || true
echo "--- firefox stderr ---"
cat /tmp/w4-ff.err 2>/dev/null || true
exit 3
