# Production Readiness Map

## What Is Implemented

SmartFLN now has a complete web-app workflow:

- login and authorization
- tenant, school, class, student, and enrollment setup
- roster import validation and commit
- assessment authoring
- concept and answer-key mapping
- template publishing
- QR identity payloads
- printable paper packet HTML
- QR SVG artifact output
- scan batch and scan page workflow
- deterministic CV/OCR/HTR boundary
- confidence calculation
- teacher review queue
- teacher review decisions
- result generation and finalization
- concept analytics
- CSV export job and download
- security headers
- CORS
- rate limiting
- request metrics
- production environment template
- MongoDB index bootstrap helper and production env contract

## Milestone Coverage

| Original Milestone Area | Current Status |
| --- | --- |
| Auth and roles | Implemented |
| School, roster, class setup | Implemented |
| Assessment authoring | Implemented |
| Template and paper generation | Implemented as printable HTML and QR SVG artifacts |
| Scanning workflow | Implemented as API/web workflow with deterministic inputs |
| Image processing pipeline | Service boundary implemented; real OpenCV worker pending |
| QR identity | Signed/checksummed payload implemented; real image decoding pending |
| Answer extraction | Service boundary implemented |
| OCR/HTR | Deterministic recognizer boundary implemented; trained model pending |
| MCQ/numeric/matching evaluation | Deterministic scoring and review routing implemented |
| Teacher review | Implemented |
| Result generation | Implemented |
| Basic analytics | Implemented |
| Export center | Implemented with CSV download |
| Production hardening | Partially implemented |
| Pilot release | Needs infrastructure and real pilot data |
| Scale release | Needs durable persistence, workers, storage, monitoring, and model services |

## Remaining Production Integrations

- MongoDB-backed repositories for every store method. The schema/index plan and env contract are ready, but runtime data is still in-memory until this integration is completed.
- object storage adapter for scans/crops/papers/exports
- browser camera capture and multipart uploads
- PDF renderer for paper packets and reports
- QR image generation and QR image decoding library
- background queue and workers
- OpenCV page processing worker
- trained OCR/HTR service
- model evaluation dashboard
- user invitation and password reset
- real OTP/SMS
- production monitoring and alerting
- cloud deployment automation

## Recommended Next Engineering Order

1. Connect MongoDB Atlas persistence.
2. Add object storage adapter.
3. Add PDF paper/report rendering.
4. Add browser camera upload.
5. Add queue workers.
6. Replace deterministic scan processing with OpenCV/QR worker.
7. Add OCR/HTR model service.
8. Run pilot with labeled classroom data.
9. Harden monitoring, backups, and access controls.
