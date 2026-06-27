# SmartFLN API

This app contains the SmartFLN backend API.

Milestone 1 uses Express.js on Node.js as the API foundation for the MERN web MVP. It keeps an in-memory development/test store while exposing MongoDB-ready persistence boundaries for upcoming data milestones.

## Local Run

```bash
node apps/api/src/main.js
```

Default health endpoints:

- `GET /health/live`
- `GET /health/ready`
- `GET /version`

Milestone 1 auth endpoints:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/otp/request`
- `POST /api/v1/auth/otp/verify`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/tenants/current`
- `GET /api/v1/roles`
- `GET /api/v1/permissions`

Milestone 2 roster endpoints:

- `GET /api/v1/schools`
- `POST /api/v1/schools`
- `GET /api/v1/academic-years`
- `POST /api/v1/academic-years`
- `GET /api/v1/class-sections`
- `POST /api/v1/class-sections`
- `GET /api/v1/class-sections/:classSectionId/students`
- `GET /api/v1/students`
- `POST /api/v1/students`
- `POST /api/v1/students/:studentId/enrollments`
- `POST /api/v1/students/imports`
- `POST /api/v1/students/imports/:importId/commit`

Integrated workflow endpoints:

- `GET /api/v1/concepts`
- `GET /api/v1/assessments`
- `POST /api/v1/assessments`
- `POST /api/v1/assessments/:assessmentId/questions`
- `POST /api/v1/assessments/:assessmentId/publish`
- `POST /api/v1/paper-batches`
- `GET /api/v1/paper-batches/:paperBatchId`
- `GET /api/v1/paper-pages/:paperPageId/qr`
- `GET /api/v1/paper-pages/:paperPageId/qr.svg`
- `GET /api/v1/paper-batches/:paperBatchId/print`
- `POST /api/v1/scan-batches`
- `POST /api/v1/scan-batches/:scanBatchId/pages`
- `GET /api/v1/answer-crops`
- `GET /api/v1/review-tasks`
- `POST /api/v1/review-tasks/:taskId/decision`
- `GET /api/v1/assessments/:assessmentId/results`
- `POST /api/v1/assessments/:assessmentId/finalize`
- `GET /api/v1/analytics/assessments/:assessmentId/summary`
- `POST /api/v1/exports`
- `GET /api/v1/exports/:exportJobId`
- `GET /api/v1/exports/:exportJobId/download`
- `GET /api/v1/system/requirements`

Demo credentials:

- teacher: `teacher@smartfln.local`
- admin: `admin@smartfln.local`
- password: `SmartFLN@123`

## Test

```bash
node --test apps/api/test/*.test.js
```
