# HomeworkAI Backend

TypeScript + Express API that powers the HomeworkAI experience: authenticated users upload PDFs, the backend parses them, runs Gemini for analysis, and can render the results back to PDF for distribution. Storage and queueing are designed to scale as workloads grow.

## Tech Stack

- **Runtime:** Node.js 18+, Express, Zod
- **Persistence:** PostgreSQL (Prisma ORM)
- **Object storage:** MinIO/S3 via AWS SDK v3
- **LLM:** Google Gemini 2.5 (JSON mode)
- **Rendering:** pdfkit (streamed PDF generation)
- **Background jobs:** BullMQ worker + Redis (analysis queue)

## Key Features

- JWT authentication with registration/login flows (`/auth/register`, `/auth/login`)
- User provisioning endpoint for internal tooling (`/users`)
- Secure upload lifecycle: presign → client PUT → confirm metadata
- PDF parsing to structured text with `pdf-parse`
- LLM analysis producing a slim JSON schema and persisting results
- PDF rendering of LLM output back into storage
- BullMQ worker that processes queued analyses off the request path (must be running to finish analyses)

## Request Flow

1. **Authenticate:** client registers/logs in to receive a JWT.
2. **Presign Upload:** `POST /api/v1/upload/presign` returns an S3 PUT URL plus `uploadId`.
3. **Client Uploads File:** browser PUTs PDF directly to storage.
4. **Confirm Upload:** `POST /api/v1/upload/confirm` validates object metadata and marks the upload as `uploaded`.
5. **Parse:** `POST /api/v1/parse/:uploadId/parse` downloads the object, extracts text, and stores a `ParseResult`.
6. **Analyze request:** `POST /api/v1/analyze/:uploadId` enqueues an analysis job (status `queued`) that the worker will process.
7. **Worker executes:** the BullMQ worker pulls the job, calls Gemini, and updates the `AnalysisResult` with output/status.
8. **Render:** `POST /api/v1/upload/:uploadId/analyses/:analysisId/render` validates the slim schema from a completed analysis, renders a PDF, and writes it back to storage.
9. **Retrieve:** users can list uploads, fetch individual records, or pull analysis JSON after the worker finishes.

## API Surface (summary)

| Area    | Endpoint(s)                                                                                                                    | Notes                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Auth    | `POST /auth/register`, `POST /auth/login`                                                                                      | Zod-validated payloads, bcrypt hashing, JWT issuing   |
| Users   | `POST /users`                                                                                                                  | Direct user creation by staff tools; hashes passwords |
| Upload  | `POST /upload/presign`, `POST /upload/confirm`, `GET /upload/list`, `GET /upload/:uploadId`, `DELETE /upload/:uploadId/delete` | All require JWT; enforce ownership                    |
| Parse   | `POST /parse/:uploadId/parse`                                                                                                  | Requires JWT, produces/updates `ParseResult`          |
| Analyze | `POST /analyze/:uploadId`                                                                                                      | Enqueues job; worker runs Gemini and persists result  |
| Render  | `POST /upload/:uploadId/analyses/:analysisId/render`                                                                           | Renders slim analysis to PDF                          |

> All routes above are mounted under `/api/v1` in `backend/src/app.ts`.

## Project Structure

```
backend/
  src/
    app.ts                    # Express bootstrap & route mounting
    config/                   # Storage & Redis client setup
    controller/               # HTTP controllers for auth/upload/parse/analyze/render
    middleware/               # JWT auth middleware
    processors/               # BullMQ job processors
    queues/                   # Queue helper(s)
    routes/                   # Express routers
    schema/                   # Zod schemas
    services/                 # LLM, parsing, rendering, storage helpers
    utils/                    # Formatting + prompt helpers
    workers/                  # BullMQ worker bootstrap
  prisma/
    schema.prisma             # Database schema
```

## Environment Variables

Create `backend/.env` using `backend/.env.example` as a template.

| Category | Variables                                                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Server   | `PORT`, `NODE_ENV`                                                                                                                       |
| Database | `DATABASE_URL`                                                                                                                           |
| Auth     | `JWT_SECRET`                                                                                                                             |
| Storage  | `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_BUCKET`, `STORAGE_FORCE_PATH_STYLE` |
| LLM      | `GOOGLE_API_KEY`                                                                                                                         |
| Queue    | `REDIS_URL` _(required for the analysis queue/worker to complete jobs)_                                                                  |

## Getting Started

1. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```
2. **Database**
   - Ensure Postgres is running and `DATABASE_URL` points to it.
   - Generate and apply migrations:
     ```bash
     npx prisma migrate dev
     npx prisma generate
     ```
3. **Storage**
   - Start MinIO or configure AWS S3 credentials.
   - Ensure the target bucket exists and matches `STORAGE_BUCKET`.
4. **Run the API**
   ```bash
   npm run dev:api
   ```
   The server listens on `http://localhost:3000/api/v1` by default.

## Background Analysis Worker

Long-running LLM analyses are handled asynchronously and require this worker to complete:

1. Provide a Redis connection string via `REDIS_URL`.
2. Start the worker in watch mode:
   ```bash
   npm run dev:worker
   ```
   Use `npm run build:worker` if you need a single-run execution.

The worker consumes BullMQ jobs using `backend/src/processors/analyze.processor.ts`, validates payloads with Zod, runs Gemini, and persists the finished JSON + status updates. Without Redis connectivity or the worker process, analyses will remain in the `queued` state.

## Operational Notes

- **Parsing & Analysis:** All LLM inputs are shaped via `makeLLMInputFromText`; ensure extracted spans stay within Gemini context limits.
- **Rendering:** The render controller trusts only JSON that passes `resultSchema` before emitting PDFs.
- **Security:** Ownership checks are enforced on upload, parse, analyze, and render routes; JWT payloads carry `userId`.
- **Observability:** Console logs exist for LLM prompts/results—tighten or replace with structured logging in production.

## Troubleshooting

- `401 Unauthorized`: confirm JWT in `Authorization: Bearer <token>`.
- `403 Forbidden`: upload or analysis belongs to a different user.
- `404 Parse/Analyze`: make sure parsing completed before triggering analysis/render.
- `Invalid LLM output`: Gemini must emit strict JSON; the worker/controller surfaces schema errors.
- Analyses stuck in `queued`: ensure Redis is reachable and the worker is running.

## Scripts

- `npm run dev:api` – start the API with `tsx` in watch mode
- `npm run dev:worker` – start the BullMQ worker with `tsx` watch
- `npm run build:api` – run the API entrypoint once (useful for prod builds/tests)
- `npm run build:worker` – run the worker entrypoint once
- `npx prisma migrate dev` – apply schema changes locally
- `npx prisma generate` – regenerate Prisma client

---

Proprietary – adjust licensing and distribution terms as required.
