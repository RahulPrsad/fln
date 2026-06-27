"""OCR/HTR adapters for answer recognition."""

from __future__ import annotations

import importlib.util
import json
import os
import urllib.error
import urllib.request
from typing import Any

from PIL import Image

from .preprocess import image_to_data_url

MODEL_NAME = "smartfln-structured-ocr"
MODEL_VERSION = "0.2.0"


def available_ocr_providers() -> dict[str, bool]:
    """Report OCR engines visible to the Python runtime."""

    return {
        "pytesseract": importlib.util.find_spec("pytesseract") is not None,
        "easyocr": importlib.util.find_spec("easyocr") is not None,
        "paddleocr": importlib.util.find_spec("paddleocr") is not None,
        "openai": bool(os.getenv("OPENAI_API_KEY") or os.getenv("SMARTFLN_OPENAI_API_KEY")),
    }


def _fallback_result(status: str, diagnostics: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "recognizedAnswer": "",
        "confidence": 0.35,
        "modelName": MODEL_NAME,
        "modelVersion": MODEL_VERSION,
        "providerStatus": status,
        "diagnostics": diagnostics or {},
    }


def _recognize_with_tesseract(image: Image.Image) -> dict[str, Any]:
    if not available_ocr_providers()["pytesseract"]:
        return _fallback_result("pytesseract_not_installed")

    try:  # pragma: no cover - optional local dependency
        import pytesseract

        text = pytesseract.image_to_string(image, config="--psm 7").strip()
        confidence = 0.72 if text else 0.38
        return {
            "recognizedAnswer": text,
            "confidence": confidence,
            "modelName": "tesseract",
            "modelVersion": "system",
            "providerStatus": "ok" if text else "empty",
            "diagnostics": {"engine": "pytesseract", "psm": 7},
        }
    except Exception as error:
        return _fallback_result("pytesseract_error", {"error": str(error)})


def _recognize_with_easyocr(image: Image.Image) -> dict[str, Any]:
    if not available_ocr_providers()["easyocr"]:
        return _fallback_result("easyocr_not_installed")

    try:  # pragma: no cover - optional local dependency
        import easyocr
        import numpy as np

        reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        detections = reader.readtext(np.array(image), detail=1, paragraph=False)
        text_parts = [item[1] for item in detections]
        confidences = [float(item[2]) for item in detections if len(item) > 2]
        confidence = sum(confidences) / len(confidences) if confidences else 0.4
        return {
            "recognizedAnswer": " ".join(text_parts).strip(),
            "confidence": round(max(0.0, min(0.99, confidence)), 3),
            "modelName": "easyocr",
            "modelVersion": "pretrained-en",
            "providerStatus": "ok" if text_parts else "empty",
            "diagnostics": {"engine": "easyocr", "detections": len(detections)},
        }
    except Exception as error:
        return _fallback_result("easyocr_error", {"error": str(error)})


def _recognize_with_paddleocr(image: Image.Image) -> dict[str, Any]:
    if not available_ocr_providers()["paddleocr"]:
        return _fallback_result("paddleocr_not_installed")

    try:  # pragma: no cover - optional local dependency
        import numpy as np
        from paddleocr import PaddleOCR

        ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
        result = ocr.ocr(np.array(image), cls=True)
        lines = []
        confidences = []
        for page in result or []:
            for item in page or []:
                text, confidence = item[1]
                lines.append(text)
                confidences.append(float(confidence))
        confidence = sum(confidences) / len(confidences) if confidences else 0.4
        return {
            "recognizedAnswer": " ".join(lines).strip(),
            "confidence": round(max(0.0, min(0.99, confidence)), 3),
            "modelName": "paddleocr",
            "modelVersion": "pretrained-en",
            "providerStatus": "ok" if lines else "empty",
            "diagnostics": {"engine": "paddleocr", "detections": len(lines)},
        }
    except Exception as error:
        return _fallback_result("paddleocr_error", {"error": str(error)})


def _extract_openai_text(response: dict[str, Any]) -> str:
    if isinstance(response.get("output_text"), str):
        return response["output_text"]

    chunks: list[str] = []
    for output in response.get("output", []) or []:
        for content in output.get("content", []) or []:
            text = content.get("text")
            if isinstance(text, str):
                chunks.append(text)
    return "\n".join(chunks).strip()


def _recognize_with_openai(image: Image.Image, question: dict[str, Any]) -> dict[str, Any]:
    api_key = os.getenv("SMARTFLN_OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        return _fallback_result("openai_key_missing")

    model = os.getenv("SMARTFLN_OPENAI_MODEL", "gpt-5.5")
    data_url = image_to_data_url(image)
    prompt = (
        "You are reading one cropped answer box from a primary-school assessment. "
        "Return compact JSON only with keys text and confidence. "
        "Read the student's handwritten answer exactly. "
        f"Question label: {question.get('label')}. "
        f"Question type: {question.get('type')}. "
        f"Prompt: {question.get('prompt', '')}"
    )
    body = {
        "model": model,
        "input": [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                    {"type": "input_image", "image_url": data_url, "detail": "high"},
                ],
            }
        ],
    }

    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:  # pragma: no cover - network path is not used in unit tests
        with urllib.request.urlopen(request, timeout=45) as response:
            payload = json.loads(response.read().decode("utf-8"))
        text_payload = _extract_openai_text(payload)
        parsed = json.loads(text_payload) if text_payload.strip().startswith("{") else {"text": text_payload}
        text = str(parsed.get("text", "")).strip()
        confidence = float(parsed.get("confidence", 0.78 if text else 0.4))
        return {
            "recognizedAnswer": text,
            "confidence": round(max(0.0, min(0.99, confidence)), 3),
            "modelName": model,
            "modelVersion": "openai-vision",
            "providerStatus": "ok" if text else "empty",
            "diagnostics": {"engine": "openai.responses"},
        }
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="ignore")[:500]
        return _fallback_result("openai_http_error", {"status": error.code, "detail": detail})
    except Exception as error:
        return _fallback_result("openai_error", {"error": str(error)})


def recognize_answer(image: Image.Image, question: dict[str, Any]) -> dict[str, Any]:
    """Run the selected OCR provider against a preprocessed answer ROI."""

    provider = os.getenv("SMARTFLN_MODEL_OCR_PROVIDER", "auto").strip().lower()

    if provider == "openai":
        return _recognize_with_openai(image, question)
    if provider == "paddleocr":
        return _recognize_with_paddleocr(image)
    if provider == "easyocr":
        return _recognize_with_easyocr(image)
    if provider == "tesseract":
        return _recognize_with_tesseract(image)

    for candidate in ("paddleocr", "easyocr", "tesseract"):
        if candidate == "paddleocr" and available_ocr_providers()["paddleocr"]:
            return _recognize_with_paddleocr(image)
        if candidate == "easyocr" and available_ocr_providers()["easyocr"]:
            return _recognize_with_easyocr(image)
        if candidate == "tesseract" and available_ocr_providers()["pytesseract"]:
            return _recognize_with_tesseract(image)

    return _fallback_result(
        "ocr_engine_not_configured",
        {
            "availableProviders": available_ocr_providers(),
            "hint": "Set SMARTFLN_MODEL_OCR_PROVIDER=openai with an API key, or install an OCR extra such as paddleocr/easyocr.",
        },
    )
