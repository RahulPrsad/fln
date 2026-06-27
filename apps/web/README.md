# SmartFLN Web

This folder is reserved for the SmartFLN React web application.

For MVP, teacher, admin, scanning, review, results, and analytics workflows all live in this web app. There is no separate mobile app in MVP scope.

Current MVP surfaces:

- teacher login
- admin login
- admin roster setup
- school setup
- academic year setup
- class setup
- student setup
- CSV roster import validation and commit
- teacher assigned-class roster view

Planned surfaces:

- teacher dashboard
- teacher paper scanner using browser camera APIs
- admin dashboard
- school and roster management
- assessment builder
- paper generator
- scan monitor
- teacher review
- results
- analytics
- exports

## Local Run

Use the root workspace install, then run:

```bash
pnpm --filter @smartfln/web dev
```

By default the web app calls the API at `http://127.0.0.1:8080`. Override with:

```bash
VITE_SMARTFLN_API_BASE_URL=http://127.0.0.1:8080
```
