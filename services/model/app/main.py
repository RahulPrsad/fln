"""SmartFLN model service.

Run locally:

    python -m app.main

The same `/v1/infer` endpoint supports the existing crop-level backend contract
and the new full-page QR/template evaluation contract.
"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse

from app.pipeline.evaluator import infer
from app.pipeline.recognition import MODEL_NAME, MODEL_VERSION, available_ocr_providers

SERVICE_NAME = "smartfln-model"


def health() -> dict[str, Any]:
    return {
        "service": SERVICE_NAME,
        "status": "ok",
        "modelName": MODEL_NAME,
        "modelVersion": MODEL_VERSION,
        "ocrProviders": available_ocr_providers(),
        "endpoints": ["GET /", "GET /health", "POST /v1/infer"],
    }


class Handler(BaseHTTPRequestHandler):
    def _json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/" or path == "/health":
            self._json(200, health())
            return
        self._json(404, {"error": "not_found"})

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/v1/infer":
            self._json(404, {"error": "not_found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            self._json(200, infer(payload))
        except Exception as error:
            self._json(400, {"error": str(error)})

    def log_message(self, format: str, *args: Any) -> None:
        return


def serve(host: str = "127.0.0.1", port: int = 8090) -> None:
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"{SERVICE_NAME} listening on http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    serve()
