# SmartFLN OCR/HTR Provider Strategy

## MVP Direction

SmartFLN should not run OCR on the full photographed page. The production path is:

1. Decode the QR identity.
2. Resolve the assessment template and page layout.
3. Detect the paper boundary and perspective-correct the page.
4. Crop each answer box ROI from known template coordinates.
5. Send each ROI crop to a pretrained OCR/HTR provider.
6. Score only high-confidence answers automatically.
7. Send low-confidence or unsupported answer types to teacher review.

## Pretrained Model Layer

The OCR/HTR layer must be provider-based so the product can switch models without changing teacher workflow.

Recommended provider classes:

- `cloud_htr`: managed handwriting OCR for early pilots.
- `vision_llm`: multimodal model for short-answer reasoning after ROI crop.
- `custom_transformer`: fine-tuned handwriting model after enough verified SmartFLN crops are collected.

## MVP Behavior

The current MVP now performs QR identity resolution and answer ROI crop preview in the teacher scanner. When no OCR provider is configured, uploaded sheet scans create low-confidence crops and route them to teacher review instead of pretending to recognize handwriting.

## Production Requirement

Before automatic handwritten scoring is enabled, each OCR provider must return:

- recognized text or structured answer
- confidence score
- provider/model/version
- raw response reference
- crop-level error status

Any answer below threshold must remain review-first.
