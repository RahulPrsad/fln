# ADR 0001: Dependency-Light Foundation

## Status

Accepted

## Context

Milestone 0 needs a deployable foundation with tests. The current local environment has Node.js available, but `npm` is not currently usable. A foundation that depends on package installation would block the first milestone.

## Decision

Start with a dependency-free Node.js API service that exposes health and version endpoints using built-in Node modules. Keep the repository structure aligned with the planned production architecture:

- `apps/api`
- `apps/web`
- `services/ai`
- `services/workers`
- `packages/shared`
- `infra`
- `docs`

The API service can later be migrated to the selected framework while preserving the route contracts, health checks, environment configuration, and service boundaries.

## Consequences

- Milestone 0 can run and test without external dependencies.
- CI can run with only Node.js.
- The initial API is intentionally small.
- Later milestones should revisit the backend framework decision once package management is available.
