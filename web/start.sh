#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
cd "$(dirname "$0")"
echo "Alberich Web – http://localhost:8765  (zero telemetry, local only)"
echo "Beenden mit Strg+C"
exec python3 - <<'PY'
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

CSP = (
    "default-src 'self'; script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
    "font-src 'self'; connect-src 'none'; media-src 'self' blob:; "
    "worker-src 'self' blob:; object-src 'none'; base-uri 'none'; "
    "frame-ancestors 'none'; form-action 'none'"
)

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
