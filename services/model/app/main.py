"""Entry point placeholder for the future SmartFLN model inference service.

The current production API still uses apps/api/src/modules/ocr/ocrService.js.
This package exists so computer vision and HTR work can evolve without
disturbing the MERN application.
"""


def health() -> dict:
    return {
        "service": "smartfln-model",
        "status": "scaffold",
        "modelVersion": None,
    }
