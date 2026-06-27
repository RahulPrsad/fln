"""End-to-end structured scan evaluation pipeline."""

from __future__ import annotations

from typing import Any

from .preprocess import (
    estimate_image_quality,
    load_image_from_data_url,
    preprocess_roi,
)
from .recognition import MODEL_NAME, MODEL_VERSION, recognize_answer
from .roi import crop_answer_roi, roi_quality
from .scoring import score_answer
from .templates import TemplateError, load_template
from .vision import align_page, detect_page_markers, parse_qr_payload, read_qr_text


def infer_crops(payload: dict[str, Any]) -> dict[str, Any]:
    """Maintain the existing crop-level contract used by the MERN API."""

    results = []
    for crop in payload.get("crops", []):
        question = {
            "question_id": crop.get("questionId"),
            "label": crop.get("questionId"),
            "type": crop.get("questionType"),
            "prompt": crop.get("prompt", ""),
            "answer_key": crop.get("answerKey"),
            "marks": crop.get("maxMarks") or crop.get("marks") or 1,
            "auto_score": True,
        }
        try:
            image = load_image_from_data_url(str(crop.get("imageDataUrl", "")))
            processed = preprocess_roi(image)
            recognition = recognize_answer(processed, question)
            scoring = score_answer(question, recognition["recognizedAnswer"], recognition["confidence"])
        except Exception as error:
            recognition = {
                "recognizedAnswer": "",
                "confidence": 0.2,
                "modelName": MODEL_NAME,
                "modelVersion": MODEL_VERSION,
                "providerStatus": "crop_error",
                "diagnostics": {"error": str(error)},
            }
            scoring = {
                "confidence": 0.2,
                "confidenceBand": "very_low",
                "needsReview": True,
                "awardedMarks": 0.0,
                "maxMarks": float(question["marks"]),
                "status": "needs_review",
            }

        results.append(
            {
                "questionId": crop.get("questionId"),
                "recognizedAnswer": recognition["recognizedAnswer"],
                "confidence": scoring["confidence"],
                "needsReview": scoring["needsReview"],
                "modelName": recognition["modelName"],
                "modelVersion": recognition["modelVersion"],
                "providerStatus": recognition["providerStatus"],
                "diagnostics": {
                    **recognition.get("diagnostics", {}),
                    "scoring": scoring,
                    "questionType": crop.get("questionType"),
                },
            }
        )

    return {
        "scanPageId": payload.get("scanPageId"),
        "assessmentId": payload.get("assessmentId"),
        "studentId": payload.get("studentId"),
        "results": results,
    }


def infer_full_scan(payload: dict[str, Any]) -> dict[str, Any]:
    """Evaluate a full scanned answer sheet using QR identity and template ROIs."""

    scan_id = payload.get("scanPageId") or payload.get("scan_id")
    image = load_image_from_data_url(str(payload.get("imageDataUrl", "")))
    page_quality = estimate_image_quality(image)

    qr_result = read_qr_text(image, payload.get("qrText"))
    qr_identity = parse_qr_payload(qr_result.get("qrText"))
    paper_id = payload.get("paper_id") or payload.get("paperId") or qr_identity.get("paper_id")
    student_id = payload.get("student_id") or payload.get("studentId") or qr_identity.get("student_id")
    test_id = payload.get("test_id") or payload.get("testId") or qr_identity.get("test_id")

    template = load_template(paper_id, payload.get("template"))
    if not test_id:
        test_id = template.get("test_id")

    markers = detect_page_markers(image)
    alignment = align_page(image, markers, template.get("page"))
    aligned_page = alignment["image"]

    answers = []
    total_marks = 0.0
    awarded_marks = 0.0
    review_count = 0

    for question in template["questions"]:
        crop, normalized_roi = crop_answer_roi(aligned_page, question["roi"])
        crop_metrics = roi_quality(crop)
        processed_roi = preprocess_roi(crop)
        recognition = recognize_answer(processed_roi, question)
        scoring = score_answer(
            question,
            recognition["recognizedAnswer"],
            recognition["confidence"],
            crop_metrics["quality"],
        )
        total_marks += scoring["maxMarks"]
        awarded_marks += scoring["awardedMarks"]
        review_count += 1 if scoring["needsReview"] else 0
        answers.append(
            {
                "question_id": question["question_id"],
                "label": question["label"],
                "type": question["type"],
                "recognized_answer": recognition["recognizedAnswer"],
                "answer_key": question.get("answer_key"),
                "awarded_marks": scoring["awardedMarks"],
                "max_marks": scoring["maxMarks"],
                "confidence": scoring["confidence"],
                "confidence_band": scoring["confidenceBand"],
                "needs_teacher_review": scoring["needsReview"],
                "status": scoring["status"],
                "normalized_answer": scoring.get("normalizedAnswer"),
                "normalized_key": scoring.get("normalizedKey"),
                "match_score": scoring.get("matchScore"),
                "is_correct": scoring.get("isCorrect"),
                "roi": normalized_roi,
                "crop_quality": crop_metrics,
                "ocr": {
                    "model_name": recognition["modelName"],
                    "model_version": recognition["modelVersion"],
                    "provider_status": recognition["providerStatus"],
                    "diagnostics": recognition.get("diagnostics", {}),
                },
            }
        )

    final_confidence = min(
        float(page_quality["qualityScore"]),
        float(qr_result.get("confidence", 0.0)) if qr_result.get("qrText") else 0.4,
        float(alignment.get("confidence", 0.5)),
        min((answer["confidence"] for answer in answers), default=0.0),
    )

    return {
        "scan_id": scan_id,
        "student_id": student_id,
        "paper_id": paper_id,
        "test_id": test_id,
        "identity": {
            "qr_text": qr_result.get("qrText"),
            "qr_status": qr_result.get("status"),
            "qr_provider": qr_result.get("provider"),
            "parsed": qr_identity,
        },
        "page": {
            "standard_width": aligned_page.width,
            "standard_height": aligned_page.height,
            "quality": page_quality,
            "markers": markers,
            "alignment": {
                key: value
                for key, value in alignment.items()
                if key != "image"
            },
        },
        "answers": answers,
        "total_marks": round(total_marks, 2),
        "awarded_marks": round(awarded_marks, 2),
        "percentage": round((awarded_marks / total_marks) * 100, 2) if total_marks else 0.0,
        "needs_teacher_review": review_count > 0,
        "review_count": review_count,
        "final_confidence": round(final_confidence, 3),
        "pipeline": [
            "uploaded",
            "qr_decoded" if qr_result.get("qrText") else "qr_pending",
            "markers_detected" if markers.get("status") == "detected" else "markers_fallback",
            "page_aligned",
            "template_loaded",
            "answer_rois_cropped",
            "roi_preprocessed",
            "ocr_completed",
            "answers_scored",
            "review_routed",
        ],
    }


def infer(payload: dict[str, Any]) -> dict[str, Any]:
    """Route request payloads to crop inference or full-page inference."""

    if payload.get("imageDataUrl"):
        try:
            return infer_full_scan(payload)
        except TemplateError as error:
            return {
                "error": "template_error",
                "message": str(error),
                "needs_teacher_review": True,
            }
    return infer_crops(payload)
