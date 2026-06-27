# SmartFLN Production Inputs Needed

To deploy SmartFLN for real school usage, provide these values. Do not commit secrets to Git.

## Required

| Item | Environment Variable | What I Need From You |
| --- | --- | --- |
| MongoDB Atlas URI | `SMARTFLN_MONGO_URI` | Full connection string, including username/password and cluster host |
| MongoDB database name | `SMARTFLN_MONGO_DB_NAME` | Example: `smartfln_prod` |
| JWT secret | `SMARTFLN_JWT_SECRET` | 64+ byte random secret |
| QR signing secret | `SMARTFLN_QR_SIGNING_SECRET` | 64+ byte random secret |
| Web app domain | `SMARTFLN_PUBLIC_APP_URL` | Example: `https://app.smartfln.com` |
| API domain | `SMARTFLN_PUBLIC_API_URL` | Example: `https://api.smartfln.com` |
| CORS origins | `SMARTFLN_CORS_ORIGINS` | Comma-separated allowed web URLs |
| Object storage bucket | `SMARTFLN_OBJECT_STORAGE_BUCKET` | S3/R2/GCS bucket for scans, crops, papers, exports |
| Object storage provider | `SMARTFLN_OBJECT_STORAGE_PROVIDER` | `s3`, `r2`, `gcs`, or `local` |

## Recommended Before Pilot

| Item | Why Needed |
| --- | --- |
| Cloud provider | Where API, web, workers, and storage will run |
| Deployment target | Render, Railway, AWS ECS, Azure App Service, GCP Cloud Run, or VPS |
| School logo/branding | Printable papers and reports |
| First pilot school details | Tenant, school, classes, teachers, student roster |
| OTP/SMS provider | Real teacher OTP delivery |
| Email provider | Invites, result reports, export notifications |
| Error tracking DSN | Sentry or equivalent |
| Analytics/monitoring endpoint | Production observability |

## AI/CV Inputs Needed

| Item | Purpose |
| --- | --- |
| Sample printed papers | Validate QR, anchors, answer regions, and page layout |
| Real classroom scan samples | Test lighting, blur, shadows, angles, phone quality |
| Labeled answer crops | Train/evaluate handwriting recognition |
| Supported languages | English, Hindi, regional language scope |
| Question type policy | Which question types can auto-score in pilot |
| Teacher review rubric | Rules for partial marks and overrides |

## Current Defaults

The repository runs locally with:

- in-memory data
- demo users
- deterministic QR payloads
- deterministic OCR/HTR-style outputs
- local web/API servers

Production should use:

- MongoDB Atlas
- object storage
- strong secrets
- real domains
- real scan upload pipeline
- background workers
- monitored AI/CV services

## Current Persistence Caveat

The application currently runs with in-memory repositories. MongoDB configuration and index bootstrap helpers are present, but the runtime repository implementation still needs to be connected to MongoDB before real school data can be trusted across restarts.
