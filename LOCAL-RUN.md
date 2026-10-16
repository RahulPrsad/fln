# Local run

Run `./start-local.ps1` in PowerShell from this directory.

- Frontend and backend: http://localhost:3000/
- API check: http://localhost:3000/api/stats
- Levels worksheet service: http://127.0.0.1:4000/
- Model health: http://127.0.0.1:8090/health
- Model interface: http://127.0.0.1:8090/

Volunteer demo login: `vol.rahul@fln.org`, password `Fln@2026`.

The home page contains Volunteer login, About, and Help. The volunteer workspace
has four actions: Add student, Existing students, Generate paper, and Scan & evaluate.
New students start at Level 1; papers use their current level. Open a student record
to read saved evaluations. Generated papers and QR templates are also persisted.

Papers contain three written-answer questions, one multiple-choice question, and
one matching activity. The three text questions have visible answer boxes, with
scan coordinates matching those boxes. MCQ and matching questions use their full
question area (including options and connecting lines) for volunteer evaluation.
The QR code and four corner markers remain printed. The one-page layout and all
five scan regions have been verified with a generated sample.

Run `npm run build:local` after source changes, then restart the web/API process.
This builds with TypeScript and Rollup in the current process, so it works without
the development compiler subprocesses blocked by this sandbox.

This setup reuses installed Node dependencies from
`C:\Users\Rahul Prasad\Downloads\fln\dev2-run`. The frontend and backend
have been rebuilt from the updated source in this directory.
The backend serves the compiled frontend, so Vite and tsx are not needed
at runtime. The existing JSON database fallback supplies the local data.

The ML process uses `C:\fln-trocr\Scripts\python.exe` and its cached Microsoft
TrOCR model. OpenCV was copied from the installed Python 3.10 packages into
`.local/python-packages` and verified with this environment. No downloads
are needed. An actual OCR request successfully read the word `hello`.

Services launched by the restart script log to `.local/run` and record their
process IDs there. Startup skips ports that already have a listener.

The volunteer paper generator uses PDF-lib directly and needs no browser subprocess.
Registration, Level 1 papers, QR templates, evaluation validation, saved history,
and persistence after backend restart were verified on an isolated database.
`scripts/verify-volunteer.mjs` runs against a separate test backend on port 3010.
Start that backend with working directory `.local/verification` to keep test students
out of the main database. The existing demo authentication behavior is retained.
