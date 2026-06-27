# SmartFLN Deployment Plan

## Target Platforms

| Layer | Platform |
| --- | --- |
| Frontend | Vercel |
| Backend API | Render |
| Database | MongoDB Atlas |
| Object Storage | Cloudflare R2 |
| SMS | Twilio or MSG91 |
| Email | Resend |
| Monitoring | Sentry |

## URLs

| Surface | URL |
| --- | --- |
| Frontend | `https://smartfln.vercel.app` |
| API | `https://api-smartfln.onrender.com` |

## MongoDB Atlas

Use:

```text
mongodb+srv://<username>:<password>@fln.eyofeum.mongodb.net/smartfln_prod?retryWrites=true&w=majority&appName=Fln
```

Database:

```text
smartfln_prod
```

Credentials must be added directly in Render environment variables, not committed to Git.

## Vercel

The root `vercel.json` builds the React app from the monorepo.

Required Vercel environment variable:

```text
VITE_SMARTFLN_API_BASE_URL=https://api-smartfln.onrender.com
```

Build command:

```bash
pnpm --filter @smartfln/web build
```

Output directory:

```text
apps/web/dist
```

## Render

The root `render.yaml` defines the API service.

Render must be given these secret values manually:

- `SMARTFLN_MONGO_URI`
- `SMARTFLN_JWT_SECRET`
- `SMARTFLN_QR_SIGNING_SECRET`
- `SMARTFLN_OBJECT_STORAGE_BUCKET`
- `SMARTFLN_R2_ACCOUNT_ID`
- `SMARTFLN_R2_ACCESS_KEY_ID`
- `SMARTFLN_R2_SECRET_ACCESS_KEY`
- `SMARTFLN_R2_ENDPOINT_URL`
- `SMARTFLN_TWILIO_ACCOUNT_SID`
- `SMARTFLN_TWILIO_AUTH_TOKEN`
- `SMARTFLN_TWILIO_FROM_NUMBER`
- `SMARTFLN_RESEND_API_KEY`
- `SMARTFLN_SENTRY_DSN`

Health check:

```text
/health/ready
```

Render provides the runtime `PORT`. Do not set `SMARTFLN_API_PORT` in Render unless you intentionally override the platform port.

## Cloudflare R2

Use S3-compatible credentials and endpoint:

```text
https://<account-id>.r2.cloudflarestorage.com
```

The bucket will store:

- uploaded scan images
- answer crop images
- generated printable paper artifacts
- generated report/export artifacts

## Current Deployment Warning

The deployment profile is configured, but the runtime repository implementation is still in-memory. Before production/pilot data entry, connect store methods to MongoDB Atlas collections or data will not survive API restarts.

## Pilot Data Needed

- first pilot school roster
- teacher accounts
- sample printed papers
- sample scanned papers
- manually verified answer crops
- supported rubric and partial marking rules
