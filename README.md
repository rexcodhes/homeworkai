# HomeworkAI Backend

An Express + TypeScript backend for an AI‑assisted homework solver. Users upload assignments (PDF), files are stored in S3‑compatible storage (MinIO), uploads are confirmed, parsed to text, and optionally analyzed with an LLM (Gemini 1.5). Results can be persisted for later retrieval and scaled as the product grows.

## Overview

- API: Express (TypeScript), Zod validation
- DB: PostgreSQL via Prisma
- Object Storage: MinIO/S3 (AWS SDK v3)
- Parsing: `pdf-parse`
- LLM: Gemini 2.5 Pro (JSON mode with schema)
- Rendering: `pdfkit` (export Slim analysis output to PDF and store in S3)
- Background Jobs: BullMQ worker + Redis (analysis runs asynchronously)

## Architecture

- Storage flow
  - Presign → PUT (client → storage) → Confirm (HEAD) → Persist metadata
- Parse flow
  - GetObject → Buffer → `pdf-parse` → Persist `ParseResult` → Update `Upload.status`
- Analyze flow
  - (Async) Enqueue analysis job (BullMQ) → Worker processes and updates status/output
  - Build spans from parsed text → LLM (Gemini) with strict JSON schema → Persist `AnalysisResult`

### Data Model (Prisma)

- `User`: optional owner of uploads
- `Upload`: primary record per file; unique `(bucket,key)`; lifecycle state
- `ParseResult`: 1:1 with `Upload`, stores extracted text and page count (optional)
- `AnalysisResult`: N:1 with `Upload` (persist LLM output, status, optional usage/solution)

Check `backend/prisma/schema.prisma` for the exact schema in your repo. If you recently added `AnalysisResult`, run migrations.

## Project Structure

- `backend/src/app.ts` — Express setup and route mounting
- `backend/src/routes/*` — Route definitions (upload, parse, auth, analyze)
- `backend/src/controller/*` — Controllers
- `backend/src/service/*` — Storage, parse, LLM services
- `backend/src/middleware/auth.middleware.ts` — Bearer JWT auth
- `backend/src/db/prisma.db.ts` — Prisma client
- `backend/src/utils/format.utils.ts` — Helpers (LLM input shaping)
- `backend/prisma/schema.prisma` — Database schema

## Prerequisites

- Node.js 18+
- PostgreSQL database
- MinIO (or S3) instance and a bucket
- Gemini API key
- Redis instance (for BullMQ analysis worker; required if you run the worker)

## Environment Variables

Copy and edit `backend/.env.example` → `backend/.env`.

Required values used by the codebase:

- Server: `PORT`, `NODE_ENV`
- DB: `DATABASE_URL`
- Auth: `JWT_SECRET`
- Storage: `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_BUCKET`, `STORAGE_FORCE_PATH_STYLE`
- LLM: `GOOGLE_API_KEY`
- Queue: `REDIS_URL` (Redis connection string for BullMQ worker)

## Install & Run

1. Install dependencies

- From `backend/`:
  - `npm install`

2. Database

- Ensure `DATABASE_URL` is set
- Generate client and run migrations:
  - `npx prisma migrate dev`
  - `npx prisma generate`

3. MinIO/S3

- Start MinIO (example):
  - `minio server C:\\minio\\data --address :9000 --console-address :9090`
- Ensure `STORAGE_*` envs are set and the bucket exists

4. Start server

- From `backend/`:
  - Dev (TypeScript) with tsx: `npx tsx watch src/app.ts`
    - or with ts-node-dev: `npx ts-node-dev --respawn --transpile-only src/app.ts`
  - API base: `http://localhost:3000/api/v1`

5. Analysis worker (async processing)

Run the worker alongside the API. Both processes must load the same `.env` and use the same `REDIS_URL`.

- Dev (TypeScript) with tsx: `npx tsx watch src/workers/analyze.worker.ts`
- or with ts-node-dev: `npx ts-node-dev --respawn --transpile-only src/workers/analyze.worker.ts`
- Production (from build):
  - Build: `npx tsc`
  - Run: `node dist/workers/analyze.worker.js`

## Endpoints

Auth

- `POST /auth/register` → `{ message }` (Zod validation + bcrypt)
- `POST /auth/login` → `{ token }` (payload contains `{ userId }`)

Users

- `POST /users` → `{ userId, name, email }` (direct user provisioning; hashes password)

Upload (JWT required)

- `POST /upload/presign` ? `{ uploadId, url, bucket, key, expiresAt }` (assigns `userId`)
- `POST /upload/confirm` ? object metadata; enforces ownership; updates Upload to `uploaded`
- `GET /upload/list` ? uploads owned by the user (includes parse/analyses)
- `GET /upload/:uploadId` ? single upload (ownership enforced)
- `DELETE /upload/:uploadId/delete` ? delete upload (ownership enforced)
- `POST /upload/:uploadId/analyses/:analysisId/render` ? renders Slim output to PDF and stores back in storage

Parse (JWT required)

- `POST /parse/:uploadId/parse` → parses PDF, persists `ParseResult`

Analyze (JWT required)

- `POST /analyze/:uploadId` → builds spans, calls Gemini (JSON mode), persists `AnalysisResult`

## Typical Flow (Postman)

1. Presign

- `POST /api/v1/upload/presign`
- Body:
  ```json
  {
    "filename": "sample.pdf",
    "contentType": "application/pdf",
    "folder": "inbox"
  }
  ```
- Save `uploadId`, `url`, `bucket`, `key`

2. Upload to storage

- `PUT <url>` (from presign)
- Headers: `Content-Type: application/pdf`
- Body: binary PDF

3. Confirm

- `POST /api/v1/upload/confirm`
- Body:
  ```json
  { "key": "<key>", "bucket": "<bucket>" }
  ```

4. Parse

- `POST /api/v1/parse/<uploadId>/parse`
- Expects success and creates `ParseResult`

5. Login (for analyze)

- `POST /api/v1/auth/login`
- Body: `{ "email": "...", "password": "..." }`
- Use returned `token` as `Authorization: Bearer <token>`

6. Analyze (enqueue)

- `POST /api/v1/analyze/<uploadId>` with `Authorization` header
- Response: `200 { "message": "Analysis enqueued" }`

7. Poll for analysis result

- `GET /api/v1/upload/<uploadId>`
- Inspect `upload.analyses[]` for items:
  - `status`: `queued | running | completed | failed`
  - `output`: JSON available when `completed`

## Key Components

Storage (`backend/src/config/storage.config.ts`, `backend/src/service/storage.service.ts`)

- Configures S3 client for MinIO/S3
- Presigned PUT for browser uploads
- HEAD for confirmation

Parsing (`backend/src/service/parse.service.ts`, `backend/src/controller/parse.controller.ts`)

- Downloads object and buffers body
- Uses `pdf-parse` correctly on a Buffer
- Persists `ParseResult` via Prisma `upsert`

LLM (`backend/src/service/analyze.service.ts`)

- Gemini 2.5 Pro via `@google/generative-ai`
- JSON mode with strict `responseSchema` (Slim output)
- Returns parsed JSON used to persist `AnalysisResult`

Render (`backend/src/controller/render.controller.ts`, `backend/src/service/render.service.ts`, `backend/src/schema/result.schema.ts`)

- Validates Slim output, renders solution PDFs with `pdfkit`, and uploads them to storage

Analyze (`backend/src/controller/analyze.controller.ts`, `backend/src/queues/analysis.queue.ts`)

- Authenticated route (JWT)
- Creates an `AnalysisResult` with status `queued` and enqueues a BullMQ job
- Worker processes the job and updates status/output in the database

Workers (`backend/src/workers/analyze.worker.ts`, `backend/src/processors/analyze.processor.ts`, `backend/src/schema/job.schema.ts`)

- BullMQ + Redis worker to process queued analyses and enforce schema validation

Auth (`backend/src/middleware/auth.middleware.ts`, `backend/src/controller/auth.controller.ts`)

- Issues and verifies JWT containing `{ userId }`
- Protects `/upload`, `/parse`, `/analyze` routes in `app.ts`

## Scaling & Production Notes

- Long PDFs / Context limits
  - Use `utils/format` to cap per‑span length and total spans
  - For very large docs, implement per‑question chunking and map/reduce analysis
- Background jobs
  - Move parsing and/or analysis to workers/queues (SQS/Redis) to avoid request timeouts
  - Track job status on `AnalysisResult.status` (e.g., queued|running|completed|failed)
- DB in serverless
  - Use a pooled, serverless‑friendly Postgres (e.g., Neon) and consider Prisma Accelerate/Data Proxy
- Storage
  - Keep `STORAGE_FORCE_PATH_STYLE=true` for MinIO; for AWS S3, you can disable it
  - Consider idempotent presign via upsert on `(bucket,key)` if clients retry
- LLM cost/latency
  - Default to `gemini-1.5-flash` for throughput, switch to `-pro` for complex cases
  - Add a one‑retry loop on invalid JSON with a short repair instruction
- Security
  - Enforce owner checks (`upload.userId === req.user.userId`) across confirm/get/delete/parse/analyze
  - Validate request bodies with Zod everywhere
  - Do not log secrets; rotate keys regularly

## Troubleshooting

- 401 on analyze: ensure `Authorization: Bearer <token>` and JWT payload uses `userId` consistently
- 403 signature mismatch on PUT: ensure `Content-Type` matches presign exactly
- 404 parse/analyze: verify `uploadId` and that parsing was performed
- Prisma type errors after schema edits: run `npx prisma generate`
- Worker fails to start: confirm `REDIS_URL` is set and Redis is reachable

## Future Work

- Expand solution PDF rendering (additional templates, downloads, sharing)
- Add GET endpoints to fetch latest analysis and/or presigned downloads
- Harden user registration and ownership enforcement across flows
- Observability: structured logs, metrics, tracing
- Rate limits and quotas per user

## Scripts

From `backend/`:

- `npm run dev` — start server (nodemon)
- `npx prisma migrate dev` — apply migrations
- `npx prisma generate` — regenerate Prisma client

## License

Proprietary (adjust to your needs). Do not commit secrets.
