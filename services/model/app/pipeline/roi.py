"""Template-based answer-region extraction."""

from __future__ import annotations

from typing import Any

from PIL import Image


def _to_pixels(value: float | int, extent: int) -> int:
    if isinstance(value, float) and 0 <= value <= 1:
        return int(round(value * extent))
    return int(round(value))


def normalize_roi(roi: dict[str, Any], page_width: int, page_height: int) -> dict[str, int]:
    """Convert normalized or absolute ROI coordinates to clamped pixels."""

    x = _to_pixels(roi.get("x", 0), page_width)
    y = _to_pixels(roi.get("y", 0), page_height)
    width = _to_pixels(roi.get("width", 0), page_width)
    height = _to_pixels(roi.get("height", 0), page_height)

    left = max(0, min(page_width - 1, x))
    top = max(0, min(page_height - 1, y))
    right = max(left + 1, min(page_width, left + max(1, width)))
    bottom = max(top + 1, min(page_height, top + max(1, height)))
    return {
        "x": left,
        "y": top,
        "width": right - left,
        "height": bottom - top,
    }


def crop_answer_roi(page_image: Image.Image, roi: dict[str, Any]) -> tuple[Image.Image, dict[str, int]]:
    """Crop a single answer box from a template-aligned page."""

    normalized = normalize_roi(roi, page_image.width, page_image.height)
    left = normalized["x"]
    top = normalized["y"]
    right = left + normalized["width"]
    bottom = top + normalized["height"]
    return page_image.crop((left, top, right, bottom)), normalized


def roi_quality(crop: Image.Image) -> dict[str, Any]:
    """Estimate whether the crop is large enough for OCR."""

    min_dimension = min(crop.width, crop.height)
    area = crop.width * crop.height
    usable = min_dimension >= 40 and area >= 6000
    return {
        "width": crop.width,
        "height": crop.height,
        "area": area,
        "usable": usable,
        "quality": 0.86 if usable else 0.45,
    }
