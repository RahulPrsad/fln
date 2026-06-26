# Local Development Runbook

## Requirements

- Node.js 22 or newer
- Git

## Run API

```bash
node apps/api/src/main.js
```

Default URL:

```text
http://127.0.0.1:8080
```

Health endpoints:

```text
GET /health/live
GET /health/ready
GET /version
```

## Run Tests

```bash
node --test apps/api/test/health.test.js
```

## Environment Variables

Copy `.env.example` to `.env` when local overrides are needed.

Important variables:

- `SMARTFLN_ENV`
- `SMARTFLN_API_HOST`
- `SMARTFLN_API_PORT`
- `SMARTFLN_SERVICE_NAME`
- `SMARTFLN_LOG_LEVEL`

## Current Limitation

This environment currently has Node.js available, but `npm` is not usable. Milestone 0 therefore avoids external package dependencies.
