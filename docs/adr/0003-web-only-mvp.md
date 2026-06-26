# ADR 0003: Web-Only MVP

## Status

Accepted

## Context

The product owner clarified that the MVP should not focus on a separate mobile app. SmartFLN MVP should be delivered as a MERN stack web application only.

Teachers may still use phones to scan papers, but they should do this through the React web app in a modern browser instead of a native or React Native app.

## Decision

The MVP will be a web-only MERN application:

- React web app for teachers, admins, review, scanning, results, and analytics
- Express.js and Node.js backend APIs
- MongoDB primary application database
- Browser camera APIs for teacher paper scanning where supported
- Browser storage for temporary scan queue support where practical

No separate mobile app is included in MVP scope.

## Consequences

- `apps/mobile` is removed from the MVP foundation.
- Teacher workflows should live under the web app.
- API routes should use teacher web terminology instead of mobile-app terminology.
- Offline behavior must respect browser limitations.
- Future native or React Native apps may be reconsidered after MVP validation.
