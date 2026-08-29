#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import http.server
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]


class StatusHandler(http.server.BaseHTTPRequestHandler):
    environment = "unknown"

    def do_GET(self) -> None:
        if self.path == "/healthz":
            body = b"waiting\n"
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        current = ROOT / ".runs" / "current"
        run_name = current.resolve().name if current.exists() else "no run prepared"
        body = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(self.environment.title())} environment</title>
<style>body{{margin:0;background:#fafafa;color:#18181b;font:16px/1.6 Inter,system-ui,sans-serif}}main{{width:min(40rem,calc(100% - 2rem));margin:12vh auto}}p{{color:#52525b}}code{{background:#f4f4f5;padding:.15rem .35rem;border-radius:.25rem}}</style></head>
<body><main><p>{html.escape(self.environment.title())} portal</p><h1>The playground is not prepared yet.</h1>
<p>Current run: <code>{html.escape(run_name)}</code></p>
<p>Interactive playgrounds are optional. Run <code>./scripts/prepare-playgrounds</code> when this PR has a matching fixture; otherwise use the test evidence in the Review Portal.</p></main></body></html>""".encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        return


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--environment", required=True)
    parser.add_argument("--port", type=int, required=True)
    args = parser.parse_args()
    StatusHandler.environment = args.environment
    server = http.server.ThreadingHTTPServer(("0.0.0.0", args.port), StatusHandler)
    print(f"Serving {args.environment} placeholder on {args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
