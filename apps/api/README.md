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

Demo credentials:

- teacher: `teacher@smartfln.local`
- admin: `admin@smartfln.local`
- password: `SmartFLN@123`

## Test

```bash
node --test apps/api/test/*.test.js
```
