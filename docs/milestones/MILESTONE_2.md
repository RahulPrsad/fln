# Milestone 2: School, Roster, and Class Setup

## Status

Implemented

## Objectives

- Add tenant-scoped school, academic year, class-section, student, enrollment, and teacher-assignment records.
- Allow school admins to set up roster data through protected APIs.
- Allow teachers to see only assigned classes and enrolled students.
- Support roster import validation with row-level errors and duplicate warnings.
- Provide a web-only MERN roster setup surface for the MVP.

## Deliverables

- Protected roster APIs for schools, academic years, class sections, students, enrollments, teacher assignments, and imports.
- Authorization helper for roster-management permissions.
- In-memory store expanded to model roster data while preserving a MongoDB migration boundary.
- Seed data for demo school, academic year, class section, teacher assignment, students, and enrollments.
- CSV parser for roster import text.
- Roster import validation service.
- Roster import commit workflow.
- Admin web workspace for setup and imports.
- Teacher web workspace for assigned class rosters.
- API tests for admin setup, teacher visibility, permission denial, import validation, and import commit.
- OpenAPI roster document.

## Files

- `apps/api/src/common/authorization.js`
- `apps/api/src/common/validation.js`
- `apps/api/src/modules/schools/`
- `apps/api/src/modules/academic-years/`
- `apps/api/src/modules/class-sections/`
- `apps/api/src/modules/students/`
- `apps/api/src/modules/enrollments/`
- `apps/api/src/modules/imports/`
- `apps/api/src/modules/roster/`
- `apps/api/src/modules/platform/memoryStore.js`
- `apps/api/src/modules/platform/seedData.js`
- `apps/api/test/roster.test.js`
- `apps/web/src/main.jsx`
- `apps/web/src/styles.css`
- `docs/openapi/roster.yaml`

## Estimated Time

2-3 weeks planned. Implemented as the deployable roster foundation slice.

## Dependencies

- Milestone 1 authentication and role foundation.
- MERN stack decision.
- Web-only MVP decision.

## Acceptance Criteria

- Admin can create a school.
- Admin can create an academic year.
- Admin can create a class section.
- Admin can add students manually.
- Admin can enroll a student in a class section.
- Admin can validate a roster import.
- Admin can commit a valid roster import.
- Import shows row-level validation errors.
- Duplicate student warnings appear during import validation.
- Teacher can see assigned class after login.
- Teacher can see enrolled students for assigned class.
- Teacher cannot perform roster setup writes.
- All roster records returned by tests are tenant-scoped.

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

- Milestone 2 intentionally keeps persistence in the in-memory store for testability. MongoDB persistence is still isolated behind store method boundaries.
- Admin write operations require `school:manage` or `roster:manage`.
- Teacher read operations are limited to assigned class sections.
- CSV import accepts text content in the API and web UI. Multipart uploads and binary XLSX parsing are deferred until file upload/storage services are introduced.
- Duplicate student detection currently checks external student id and admission number within the tenant and school scope.
