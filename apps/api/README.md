# SmartFLN API

This app contains the SmartFLN backend API.

Milestone 0 intentionally uses a dependency-free Node HTTP service so the foundation can run in constrained environments. Later milestones can introduce the selected production framework without changing the high-level service boundaries.

## Local Run

```bash
node apps/api/src/main.js
```

Default health endpoints:

- `GET /health/live`
- `GET /health/ready`
- `GET /version`

## Test

```bash
node --test apps/api/test/health.test.js
```
