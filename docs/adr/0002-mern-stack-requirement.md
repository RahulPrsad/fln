# ADR 0002: MERN Stack Requirement

## Status

Accepted

## Context

The product owner clarified that SmartFLN has one hard technology requirement: the project should be built using the MERN stack.

Earlier planning documents mentioned alternatives such as PostgreSQL, FastAPI, Flutter, or NestJS. Those are now superseded unless the product owner explicitly approves an exception later.

## Decision

SmartFLN will use MERN as the required product stack:

- MongoDB for primary application data
- Express.js for REST APIs
- React for the web dashboard and admin panel
- Node.js for backend services, background workers, and AI orchestration

The teacher mobile app should use React Native so the mobile experience remains in the React ecosystem.

## Current Foundation Impact

Milestone 0 uses dependency-free Node.js because `npm` is currently broken in the local environment. This is still compatible with the Node.js part of MERN, but it is not the final backend framework.

Milestone 1 should introduce or prepare for:

- Express.js API structure
- MongoDB connection and repository patterns
- React web shell
- React Native mobile continuation

## Consequences

- Database documentation must be treated as a MongoDB collection design, not a PostgreSQL schema.
- Core API implementation should be Express.js, not FastAPI or NestJS.
- Production AI orchestration should remain behind Node.js service boundaries.
- Any non-MERN technology must be justified as an internal supporting tool and approved separately.
