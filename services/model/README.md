# SmartFLN Model Workspace

This workspace is the isolated home for SmartFLN computer vision, OCR, handwriting recognition, and model evaluation work.

The MERN product should not be edited directly when experimenting with recognition models. Model work should happen here first, behind stable contracts, then be integrated into `apps/api` only after the model path is tested.

## Purpose

- Build the paper image processing pipeline.
- Improve answer-region cropping and alignment.
- Test OCR/HTR models without changing the teacher web app.
- Store model contracts, evaluation scripts, and model artifacts separately.
- Collect teacher-corrected labels for future fine-tuning.

## Current Product Integration

The current API calls OpenAI vision OCR from `apps/api/src/modules/ocr/ocrService.js`.

The backend can also be switched to this local model service:

```text
SMARTFLN_OCR_PROVIDER=model_service
SMARTFLN_MODEL_SERVICE_URL=http://127.0.0.1:8090
```

Future production flow:

```text
apps/web camera capture
  -> apps/api scan endpoint
  -> services/model inference service
  -> apps/api scoring/review/result workflow
```

OpenAI should remain a fallback and teacher-assist layer. The production model path should eventually live in this workspace.

## Folder Structure

```text
services/model/
  README.md
  MODEL_PIPELINE.md
  pyproject.toml
  app/
    main.py
    contracts/
      inference.schema.json
    pipeline/
      preprocess.py
      roi.py
      recognition.py
      scoring.py
  data/
    raw/
    processed/
    labels/
  models/
  notebooks/
  tests/
```

## Rules For Model Work

1. Do not change teacher UI or backend workflow while experimenting with models.
2. Add sample scans under ignored local folders, not git.
3. Keep model input/output compatible with `app/contracts/inference.schema.json`.
4. Track every model experiment with accuracy, latency, and failure cases.
5. Only promote a model into the backend after it beats the current fallback on real scan samples.

## First Model Milestones

1. Collect real printed-page photos.
2. Save answer-region crops and teacher-corrected labels.
3. Build OpenCV preprocessing: crop, deskew, shadow removal, contrast.
4. Add separate detectors for MCQ, numeric, matching, and short text.
5. Evaluate dedicated HTR models against OpenAI fallback.

## Run The Scaffold Service

Use the bundled or system Python runtime:

```bash
cd services/model
python -m app.main
```

Endpoints:

- `GET /health`
- `POST /v1/infer`

The scaffold intentionally returns low-confidence empty answers. It proves the contract and integration path without pretending to be a real model.

Run tests:

```bash
python -m unittest discover services/model/tests
```
