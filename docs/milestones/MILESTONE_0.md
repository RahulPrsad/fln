# Milestone 0: Project Foundation

## Status

Implemented

## Objectives

- Establish repository structure.
- Provide a runnable API foundation.
- Add automated foundation tests.
- Add CI skeleton.
- Add environment and Docker foundation.
- Add architecture decision and local runbook documentation.

## Deliverables

- Root project metadata.
- Dependency-free Node API service.
- Health and version endpoints.
- Node test suite for foundation endpoints.
- GitHub Actions CI workflow.
- Dockerfile for API container.
- Environment example file.
- Documentation folders, ADR, and runbook.

## Files

- `package.json`
- `.gitignore`
- `.editorconfig`
- `.env.example`
- `apps/api/`
- `apps/web/`
- `services/ai/`
- `services/workers/`
- `packages/shared/`
- `infra/`
- `docker/api.Dockerfile`
- `.github/workflows/ci.yml`
- `docs/README.md`
- `docs/adr/0001-foundation-architecture.md`
- `docs/runbooks/local-development.md`

## Estimated Time

1-2 weeks planned. Implemented as the first foundation slice.

## Dependencies

- Node.js 22 or newer.
- Git.
- No package manager dependencies for this milestone.

## Acceptance Criteria

- API can be started locally.
- `GET /health/live` returns healthy status.
- `GET /health/ready` returns readiness status.
- `GET /version` returns service metadata.
- Unknown routes use standard error envelope.
- Tests pass with Node's built-in test runner.
- CI workflow exists.
- Dockerfile exists for API container.
- Documentation explains local development and the dependency-light architecture decision.

## Verification

Run:

```bash
node --test apps/api/test/health.test.js
```
