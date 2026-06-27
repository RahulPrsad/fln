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

## Model Workspace

All new model, OpenCV, OCR, HTR, crop-alignment, and evaluation work should be developed in:

```text
services/model
```

The MERN backend should keep only the provider adapter and workflow orchestration. Experimental recognition code should not be added directly inside `apps/api`.

To test the isolated local model service instead of OpenAI:

```text
SMARTFLN_OCR_PROVIDER=model_service
SMARTFLN_MODEL_SERVICE_URL=http://127.0.0.1:8090
```

The scaffold service lives at `services/model/app/main.py` and exposes `POST /v1/infer`.

## Pretrained Model Layer

The OCR/HTR layer must be provider-based so the product can switch models without changing teacher workflow.

Recommended provider classes:

- `cloud_htr`: managed handwriting OCR for early pilots.
- `vision_llm`: multimodal model for short-answer reasoning after ROI crop.
- `custom_transformer`: fine-tuned handwriting model after enough verified SmartFLN crops are collected.

## MVP Behavior

The current MVP performs QR identity resolution, answer ROI cropping in the teacher scanner, and provider-based OCR/HTR on each cropped answer box.

The web scanner sends only the cropped answer regions to the backend, not the whole classroom photo. The backend then:

- calls the configured OCR provider for each answer crop
- stores the provider/model name on the answer crop
- evaluates the answer against the answer key
- auto-scores only when confidence and question policy allow it
- sends uncertain, blank, mismatched, or unsupported answers to teacher review

When no OCR provider is configured, uploaded sheet scans still create low-confidence crops and route them to teacher review instead of pretending to recognize handwriting.

## OpenAI Provider

The MVP includes an OpenAI vision provider using the Responses API image input path.

Environment variables:

```text
SMARTFLN_OCR_PROVIDER=openai
SMARTFLN_OPENAI_API_KEY=<secret>
SMARTFLN_OPENAI_BASE_URL=https://api.openai.com/v1
SMARTFLN_OPENAI_OCR_MODEL=gpt-5.5
SMARTFLN_OPENAI_IMAGE_DETAIL=high
SMARTFLN_OCR_REQUEST_TIMEOUT_MS=20000
```

The provider prompt asks the model to return compact JSON:

```json
{"answer":"5","confidence":0.93,"notes":"clear numeric handwriting"}
```

If the model is unavailable, times out, returns unreadable output, or the API key is missing, SmartFLN marks the crop as review-needed.

## Real-Time Scan Path

1. Teacher uploads or captures the printed sheet photo.
2. Browser decodes the SmartFLN QR or accepts manual QR fallback.
3. Browser resolves the paper and downloads the answer-region template.
4. Browser crops each answer box ROI from the photo and compresses the crop.
5. API creates a scan batch and scan page.
6. API sends all ROI crops to the OCR provider in parallel.
7. API evaluates recognized answers and updates crops, review queue, results, and analytics.
8. Teacher sees recognized answers, confidence, model name, marks, and review status.

## Production Requirement

Before automatic handwritten scoring is enabled, each OCR provider must return:

- recognized text or structured answer
- confidence score
- provider/model/version
- raw response reference
- crop-level error status

Any answer below threshold must remain review-first.
