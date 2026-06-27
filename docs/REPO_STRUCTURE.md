# SmartFLN Repository Structure

SmartFLN is organized as a product monorepo. Each area has a clear boundary so work on the model does not break the MERN application.

## Main Product Areas

```text
apps/
  web/       Frontend teacher/admin web app
  api/       Backend MERN API
  android/   Android WebView wrapper APK

services/
  model/     Computer vision, OCR, HTR, and model experiments
  workers/   Future async workers
  ai/        Legacy AI placeholder; new model work should use services/model

packages/    Future shared packages
docs/        Product, architecture, API, deployment, model, and workflow docs
templates/   Source paper templates and sample worksheets
infra/       Infrastructure plans/config
docker/      Local/container setup
```

## Frontend

Path: `apps/web`

Responsibilities:

- teacher workflow UI
- question paper actions
- camera capture
- scan upload
- result display

Frontend should not contain model logic. It should only capture images and show API results.

## Backend

Path: `apps/api`

Responsibilities:

- authentication
- paper generation
- QR identity
- scan upload endpoint
- answer crop storage/state
- scoring and review workflow
- result/report APIs

Backend should call a model provider through a stable interface. It should not contain experimental model code.

## Mobile APK

Path: `apps/android`

Responsibilities:

- load the teacher web app in WebView
- camera/file capture bridge
- print bridge
- Android permissions

The APK should stay thin.

## Model Workspace

Path: `services/model`

Responsibilities:

- OpenCV preprocessing
- answer ROI crop experimentation
- MCQ detection
- numeric recognition
- matching detection
- handwriting recognition
- model evaluation
- training/fine-tuning datasets and labels

Local model data and artifacts are ignored by git. Commit only code, contracts, docs, and small test fixtures.

## Model Integration Rule

Model experiments must happen in `services/model` first.

Only after a model is tested should we connect it to:

```text
apps/api/src/modules/ocr/
```

That keeps the product workflow stable while the model improves.

## Documentation

Path: `docs`

Important folders:

- `docs/product` - product and UX docs
- `docs/architecture` - architecture, database, system flow, AI engine
- `docs/api` - REST API docs
- `docs/engineering` - implementation plans
- `docs/research` - research notes and metrics
- `docs/operations` - meeting notes

## Paper Templates

Path: `templates/papers`

This folder contains source worksheet/template files used as references for generated paper layouts.
