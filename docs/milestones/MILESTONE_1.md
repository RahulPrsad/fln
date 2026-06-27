# Milestone 1: Core Platform and Authentication

## Status

Implemented

## Objectives

- Build the MERN authentication foundation.
- Introduce Express.js as the API framework.
- Add JWT access and refresh token handling.
- Establish tenant, role, permission, and session primitives.
- Add audit events for authentication actions.
- Add a React web login shell for the web-only MVP.

## Deliverables

- Express API app with request context middleware and standard error envelope.
- CORS middleware for the React web client.
- Health and version endpoints preserved.
- Auth endpoints:
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/otp/request`
  - `POST /api/v1/auth/otp/verify`
  - `POST /api/v1/auth/refresh`
  - `POST /api/v1/auth/logout`
  - `GET /api/v1/auth/me`
- Protected tenant, role, and permission endpoints.
- JWT signing and verification service.
- In-memory seed store for development/test.
- MongoDB client boundary for future persistence milestones.
- Audit service for login/logout events.
- React web login shell connected to the login API.
- pnpm workspace and lockfile.
- API tests for auth and health.

## Files

- `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `apps/api/src/app.js`
- `apps/api/src/common/`
- `apps/api/src/modules/auth/`
- `apps/api/src/modules/audit/`
- `apps/api/src/modules/platform/`
- `apps/api/src/modules/tenants/`
- `apps/api/src/modules/users/`
- `apps/api/test/auth.test.js`
- `apps/api/test/health.test.js`
- `apps/web/package.json`
- `apps/web/index.html`
- `apps/web/src/main.jsx`
- `apps/web/src/styles.css`
- `docs/runbooks/local-development.md`

## Estimated Time

2-3 weeks planned. Implemented as the first MERN foundation slice.

## Dependencies

- Milestone 0.
- MERN stack decision.
- Web-only MVP decision.
- pnpm dependency installation.

## Acceptance Criteria

- API starts with Express.
- Health and version endpoints still work.
- Teacher demo login returns access and refresh tokens.
- Admin demo login is seeded.
- OTP request and verify create a session in test/development mode.
- Protected `/api/v1/auth/me` rejects missing tokens.
- Protected `/api/v1/auth/me` returns scoped user data with a valid token.
- Refresh token returns a new access token.
- Refresh token replay is rejected after rotation.
- Logout revokes the current session.
- Tenant, role, and permission endpoints are protected.
- React web app builds successfully.
- Tests pass.

## Verification

Run API tests:

```bash
node --test apps/api/test/*.test.js
```

Run web build:

```bash
node node_modules/vite/bin/vite.js build apps/web
```

Run dependency consistency check:

```bash
pnpm install --frozen-lockfile --offline
```

## Architecture Notes

- MongoDB is not required to run Milestone 1 tests. The API uses an in-memory store for development/test.
- `mongoStore.js` defines the MongoDB client boundary so Milestone 2 can introduce persistent school, roster, and user data without changing route contracts.
- The React shell is intentionally small but functional. It proves the web-only MVP direction and authenticates against the Milestone 1 API without starting assessment workflows prematurely.
