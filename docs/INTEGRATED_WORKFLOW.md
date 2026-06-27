# Integrated SmartFLN Web Workflow

## Status

Implemented on `dev` as one MERN web application.

## Scope

This build connects the product workflow described in the root documentation into one usable web app:

- authentication
- school roster visibility
- assessment authoring
- concept mapping
- question and answer-key setup
- template publishing
- paper batch generation
- QR identity payload creation
- scan batch creation
- scan page processing
- image quality metadata
- OCR/HTR-style answer recognition boundary
- objective evaluation
- confidence calculation
- teacher review routing
- teacher review decisions
- provisional and finalized results
- concept analytics
- CSV export jobs

## Architecture

The integrated workflow uses the existing MERN foundation:

- React web app in `apps/web`
- Express API in `apps/api`
- in-memory store for local/test execution
- MongoDB boundary retained for persistence migration
- JWT authentication and permission middleware

The workflow APIs are implemented in:

- `apps/api/src/modules/workflows/workflowService.js`
- `apps/api/src/modules/workflows/workflowRoutes.js`

The React workflow dashboard is implemented in:

- `apps/web/src/main.jsx`
- `apps/web/src/styles.css`

## Deterministic AI Boundary

The current repository does not include trained computer vision or handwriting models. Instead, the workflow service provides deterministic outputs that match the shape required by production workers:

- QR identity payload validation
- page quality metadata
- perspective correction status
- crop confidence
- OCR/HTR recognized answer
- recognition confidence
- evaluation confidence
- review routing reason
- answer crop records

This lets the full product workflow be built and tested before model assets, image queues, and external AI services are connected.

## API Coverage

The integrated workflow includes:

- `GET /api/v1/concepts`
- `GET /api/v1/assessments`
- `POST /api/v1/assessments`
- `GET /api/v1/assessments/:assessmentId`
- `POST /api/v1/assessments/:assessmentId/questions`
- `POST /api/v1/assessments/:assessmentId/publish`
- `GET /api/v1/paper-batches`
- `POST /api/v1/paper-batches`
- `GET /api/v1/paper-batches/:paperBatchId`
- `GET /api/v1/paper-pages/:paperPageId/qr`
- `POST /api/v1/paper-pages/resolve-qr`
- `GET /api/v1/scan-batches`
- `POST /api/v1/scan-batches`
- `GET /api/v1/scan-batches/:scanBatchId`
- `POST /api/v1/scan-batches/:scanBatchId/pages` with `ocrCrops[]` for real answer-box recognition
- `GET /api/v1/answer-crops`
- `GET /api/v1/review-tasks`
- `POST /api/v1/review-tasks/:taskId/decision`
- `GET /api/v1/assessments/:assessmentId/results`
- `POST /api/v1/assessments/:assessmentId/finalize`
- `GET /api/v1/analytics/assessments/:assessmentId/summary`
- `POST /api/v1/exports`
- `GET /api/v1/exports/:exportJobId`

## Verification

Run:

```bash
node --test apps/api/test/*.test.js
node node_modules/vite/bin/vite.js build apps/web
pnpm install --frozen-lockfile --offline
```

The workflow test covers the full path from authoring to export.

## Production Gaps

The following are intentionally represented by service boundaries in this build and still need production integrations:

- physical QR image generation and QR image decoding
- PDF rendering for printable paper packets
- browser camera capture and upload
- object storage for scan images and answer crops
- background queue workers
- OpenCV-based page rectification
- trained OCR/HTR models
- trained MCQ/matching detectors
- durable MongoDB repositories
- signed export download links
