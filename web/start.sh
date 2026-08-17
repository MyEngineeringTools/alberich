#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
cd "$(dirname "$0")"
echo "Alberich Web – http://localhost:8765  (zero telemetry, local only)"
echo "Beenden mit Strg+C"
exec python3 - <<'PY'
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

html = Path("index.html").read_text(encoding="utf-8")
match = re.search(r'Content-Security-Policy" content="([^"]+)"', html)
if not match:
    raise SystemExit("index.html is missing a Content-Security-Policy meta tag")
CSP = match.group(1)

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", "camera=(self), microphone=(), geolocation=(), payment=(), usb=()")
        self.send_header("X-Frame-Options", "DENY")
        super().end_headers()

ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
PY
