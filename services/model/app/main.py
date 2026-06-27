"""Dependency-free SmartFLN model service scaffold.

Run locally:

    python -m app.main

This is intentionally simple. It gives the MERN API a stable local target while
we build OpenCV and HTR stages behind the same `/v1/infer` contract.
"""

from __future__ import annotations

import base64
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse

SERVICE_NAME = "smartfln-model"
MODEL_NAME = "smartfln-htr-scaffold"
MODEL_VERSION = "0.1.0"


def health() -> dict[str, Any]:
    return {
        "service": SERVICE_NAME,
        "status": "ok",
        "modelName": MODEL_NAME,
        "modelVersion": MODEL_VERSION,
    }


def _image_size_hint(image_data_url: str) -> int:
    if "," not in image_data_url:
        return 0
    try:
        return len(base64.b64decode(image_data_url.split(",", 1)[1], validate=False))
    except Exception:
        return 0


def infer(payload: dict[str, Any]) -> dict[str, Any]:
    """Return review-safe placeholder predictions.

    The scaffold does not pretend to read handwriting. It validates the service
    shape and always emits low confidence so the API routes output to teacher
    review until a real model is plugged in.
    """

    results = []
    for crop in payload.get("crops", []):
        image_size = _image_size_hint(str(crop.get("imageDataUrl", "")))
        results.append(
            {
                "questionId": crop.get("questionId"),
                "recognizedAnswer": "",
                "confidence": 0.35,
                "needsReview": True,
                "modelName": MODEL_NAME,
                "modelVersion": MODEL_VERSION,
                "providerStatus": "scaffold",
                "diagnostics": {
                    "summary": "Scaffold model service reached; real OCR/HTR not enabled yet.",
                    "questionType": crop.get("questionType"),
                    "imageBytes": image_size,
                },
            }
        )

    return {
        "scanPageId": payload.get("scanPageId"),
        "assessmentId": payload.get("assessmentId"),
        "studentId": payload.get("studentId"),
        "results": results,
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
        if urlparse(self.path).path == "/health":
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
