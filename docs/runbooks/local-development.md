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
node --test apps/api/test/*.test.js
```

## Install Dependencies

The project uses pnpm workspaces. In a normal development environment, enable Corepack and install:

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm install
```

In this Codex workspace, `npm` is not available on PATH. Use the bundled pnpm binary if needed:

```powershell
& "C:\Users\Rahul Prasad\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "C:\Users\Rahul Prasad\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\pnpm\bin\pnpm.cjs" install
```

## Run Web Build

```bash
pnpm --filter @smartfln/web build
```

If pnpm is not on PATH in this local workspace, use Vite directly after dependencies are installed:

```bash
node node_modules/vite/bin/vite.js build apps/web
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

This environment currently has Node.js available, but `npm` is not usable. Use Corepack/pnpm or the bundled pnpm command above.
