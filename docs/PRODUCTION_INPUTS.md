# SmartFLN Production Inputs Needed

To deploy SmartFLN for real school usage, provide these values. Do not commit secrets to Git.

## Required

| Item | Environment Variable | What I Need From You |
| --- | --- | --- |
| MongoDB Atlas URI | `SMARTFLN_MONGO_URI` | `mongodb+srv://<username>:<password>@fln.eyofeum.mongodb.net/smartfln_prod?retryWrites=true&w=majority&appName=Fln` |
| MongoDB database name | `SMARTFLN_MONGO_DB_NAME` | `smartfln_prod` |
| JWT secret | `SMARTFLN_JWT_SECRET` | 64+ byte random secret |
| QR signing secret | `SMARTFLN_QR_SIGNING_SECRET` | 64+ byte random secret |
| Web app domain | `SMARTFLN_PUBLIC_APP_URL` | `https://smartfln.vercel.app` |
| API domain | `SMARTFLN_PUBLIC_API_URL` | `https://api-smartfln.onrender.com` |
| CORS origins | `SMARTFLN_CORS_ORIGINS` | `https://smartfln.vercel.app` |
| Object storage bucket | `SMARTFLN_OBJECT_STORAGE_BUCKET` | Cloudflare R2 bucket name |
| Object storage provider | `SMARTFLN_OBJECT_STORAGE_PROVIDER` | `r2` |
| R2 account id | `SMARTFLN_R2_ACCOUNT_ID` | Cloudflare account id |
| R2 access key id | `SMARTFLN_R2_ACCESS_KEY_ID` | R2 S3-compatible key id |
| R2 secret access key | `SMARTFLN_R2_SECRET_ACCESS_KEY` | R2 S3-compatible secret |
| R2 endpoint URL | `SMARTFLN_R2_ENDPOINT_URL` | `https://<account-id>.r2.cloudflarestorage.com` |

## Recommended Before Pilot

| Item | Why Needed |
| --- | --- |
| Cloud provider | Vercel, Render, MongoDB Atlas, and Cloudflare R2 |
| Deployment target | Frontend on Vercel, backend on Render |
| School logo/branding | Printable papers and reports |
| First pilot school details | Tenant, school, classes, teachers, student roster |
| OTP/SMS provider | Twilio or MSG91 |
| Email provider | Resend |
| Error tracking DSN | Sentry |
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

## Deployment Profile Provided

- Frontend: Vercel
- Backend API: Render
- Database: MongoDB Atlas cluster `fln.eyofeum.mongodb.net`
- Database name: `smartfln_prod`
- Object storage: Cloudflare R2
- SMS: Twilio or MSG91
- Email: Resend
- Monitoring: Sentry
- Initial language: English
- Planned language: Hindi
