# SmartFLN Model Pipeline

This document defines the production model pipeline we will build inside `services/model`.

## Core Principle

Do not use one OCR model for everything.

SmartFLN answer recognition should be a hybrid pipeline:

```text
QR + page detection -> OpenCV
page deskew/perspective correction -> OpenCV
template alignment -> geometry
answer ROI crop -> template coordinates
MCQ -> mark/circle detection
numeric -> digit recognition
matching -> line/shape detection
short handwritten text -> HTR model
doubtful cases -> OpenAI fallback + teacher review
```

## Model Inputs

The model service receives answer crops, not the full classroom photo, once the backend has resolved the paper identity and template.

Each crop must include:

- `scanPageId`
- `questionId`
- `questionType`
- `prompt`
- `answerKey`
- `imageDataUrl` or future object-storage URI

## Model Outputs

Each crop returns:

- `recognizedAnswer`
- `confidence`
- `modelName`
- `modelVersion`
- `providerStatus`
- `needsReview`
- `diagnostics`

## Accuracy Targets

Pilot targets:

- QR identity: 99%+
- answer crop alignment: 95%+
- MCQ recognition: 95%+
- numeric recognition: 90%+
- short handwriting recognition: 75-85% before teacher correction
- low-confidence routing recall: 95%+

Production targets after labeled data:

- MCQ recognition: 98%+
- numeric recognition: 95%+
- short handwriting recognition: 90%+ for constrained answer formats
- no automatic finalization below confidence threshold

## Evaluation Data

Store locally during development:

```text
services/model/data/raw/
services/model/data/processed/
services/model/data/labels/
```

These folders are intentionally ignored in git except `.gitkeep` files. Real student data must not be committed.

## Integration Contract

The backend should call the model service through a stable HTTP contract. That lets us swap:

- OpenAI fallback
- local Python model service
- hosted GPU inference
- fine-tuned custom HTR model

without changing the teacher workflow.

## Local Service Contract

Development endpoint:

```text
POST http://127.0.0.1:8090/v1/infer
```

Sample request and response live in:

```text
services/model/app/contracts/sample_request.json
services/model/app/contracts/sample_response.json
```

Backend switch:

```text
SMARTFLN_OCR_PROVIDER=model_service
SMARTFLN_MODEL_SERVICE_URL=http://127.0.0.1:8090
```
