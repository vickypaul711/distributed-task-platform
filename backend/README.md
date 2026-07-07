# Distributed Task Queue Backend

NestJS backend for a durable, multi-tenant task queue and job-processing platform. It powers the dashboard in `../dashboard` and provides:

- authenticated tenant-scoped job submission
- idempotency keys on create
- rate limits and concurrency quotas per plan
- claim / lease / ack / fail / retry / DLQ processing
- metrics, structured request logging, and request ids
- WebSocket and SSE real-time job events
- worker simulation and autoscaling recommendations

## Tech Stack

- NestJS + TypeScript
- PostgreSQL
- Socket.IO for browser live updates
- SSE fallback for lightweight event streaming
- Jest for tests

## Prerequisites

- Node.js 20+ recommended
- pnpm
- Docker
- PostgreSQL client tools such as `psql`

## Local Configuration

The local `.env` is:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5431/task_queue
PORT=4000
```

The dashboard expects the backend at `http://localhost:4000` by default.

## Setup

Install dependencies:

```bash
pnpm install
```

Start Postgres:

```bash
docker compose up -d
```

Apply migrations in order:

```bash
psql "$DATABASE_URL" -f migrations/001_init.sql
psql "$DATABASE_URL" -f migrations/002_add_job_errors.sql
psql "$DATABASE_URL" -f migrations/003_create_dlq.sql
psql "$DATABASE_URL" -f migrations/004_harden_job_processing.sql
psql "$DATABASE_URL" -f migrations/005_convert_timestamps_to_timestamptz.sql
```

## Run Modes

### Development API

Starts the backend API with file watching:

```bash
pnpm start:dev
```

With the included `.env`, the API listens on:

```text
http://localhost:4000
```

### Worker Loop

Starts the backend with the opt-in built-in worker loop enabled:

```bash
pnpm start:worker
```

This is equivalent to running Nest with `WORKER_ENABLED=true`.

### Production Build

```bash
pnpm run build
pnpm start:prod
```

## Dashboard Integration

The frontend in `../dashboard` connects directly to this backend.

Recommended startup:

1. Start Postgres with `docker compose up -d`.
2. Apply all migrations.
3. Run `pnpm start:dev` in this folder.
4. In `../dashboard`, run `npm install` and `npm run dev`.
5. Open `http://localhost:3000`.

What the dashboard does automatically:

- checks backend health
- creates a demo plan named `DASHBOARD_DEMO` if missing
- creates a tenant if no browser-stored API key exists
- seeds demo jobs if that tenant has no jobs
- loads jobs, metrics, DLQ, autoscaling, and tenant data
- subscribes to WebSocket events with SSE fallback

## API Overview

### Public Health And Discovery

- `GET /`
- `GET /health`
- `GET /plans`
- `POST /plans`
- `GET /tenants`
- `POST /tenants`

### Tenant-Authenticated Queue APIs

These require `x-api-key`.

- `GET /jobs`
- `GET /jobs/:id`
- `POST /jobs`
- `POST /jobs/claim`
- `POST /jobs/:id/ack`
- `POST /jobs/:id/fail`
- `GET /metrics`
- `GET /dlq`
- `GET /autoscaling/recommendation`
- `POST /workers/run-once`
- `POST /workers/simulate`
- `GET /events/jobs`

### WebSocket Namespace

```text
namespace: /jobs
auth: { "apiKey": "<tenant-api-key>" }
event received: job.status
```

## Core Workflow Examples

### 1. Create A Plan

```http
POST /plans
Content-Type: application/json

{
  "name": "FREE",
  "rateLimitPerMinute": 60,
  "maxConcurrentJobs": 5,
  "defaultMaxAttempts": 3,
  "maxAllowedAttempts": 5
}
```

### 2. Create A Tenant

```http
POST /tenants
Content-Type: application/json

{
  "name": "Acme",
  "planId": "<plan-id>"
}
```

### 3. Submit A Job

```http
POST /jobs
x-api-key: <tenant-api-key>
Content-Type: application/json

{
  "idempotencyKey": "invoice-12345",
  "payload": {
    "type": "invoice",
    "name": "Invoice Export",
    "queue": "default",
    "invoiceId": "12345"
  },
  "maxAttempts": 3
}
```

### 4. List Or Inspect Jobs

```http
GET /jobs?status=PENDING
x-api-key: <tenant-api-key>

GET /jobs/:id
x-api-key: <tenant-api-key>
```

### 5. Claim, Ack, Or Fail A Job

```http
POST /jobs/claim
x-api-key: <tenant-api-key>
x-worker-id: worker-1

POST /jobs/:id/ack
x-api-key: <tenant-api-key>
x-worker-id: worker-1

POST /jobs/:id/fail
x-api-key: <tenant-api-key>
x-worker-id: worker-1
Content-Type: application/json

{
  "reason": "handler failed"
}
```

### 6. Run A Manual Worker Pass

```http
POST /workers/run-once
x-api-key: <tenant-api-key>
```

### 7. Inspect Metrics, DLQ, And Autoscaling

```http
GET /metrics
x-api-key: <tenant-api-key>

GET /dlq
x-api-key: <tenant-api-key>

GET /autoscaling/recommendation
x-api-key: <tenant-api-key>
```

## Delivery Semantics

The queue is at-least-once.

- Workers claim jobs with a 30 second lease.
- If a worker crashes or fails to ack/fail before lease expiry, the job becomes claimable again.
- Consumers should keep job handlers idempotent.

Submission idempotency is approximated with `(tenant_id, idempotency_key)`.

- same key + same payload returns the existing job
- same key + different payload returns `409 Conflict`

## Retries And DLQ

- Every failed leased job increments `attempt_count`
- each failure records a `job_attempts` row
- if attempts remain, the job returns to `PENDING`
- when `attempt_count >= max_attempts`, the job moves to `DLQ`
- a row is inserted into `dead_letter_jobs`

For dashboard demos, payloads containing `fail: true` or `simulateFailure: true` intentionally fail.

## Quotas

Tenant plan limits are enforced for:

- submission rate per minute
- maximum attempts per job
- active running concurrency during claims

This lets the dashboard show different behaviors across plans and tenants.

## Autoscaling Recommendations

`GET /autoscaling/recommendation` returns:

- `SCALE_OUT` when pending jobs or expired leases need more workers
- `SCALE_IN` when there is no backlog and current workers exceed demand
- `HOLD` when active workers already match demand

Tuning environment variables:

- `AUTOSCALING_MIN_WORKERS`, default `0`
- `AUTOSCALING_MAX_WORKERS`, default tenant `max_concurrent_jobs`
- `AUTOSCALING_TARGET_JOBS_PER_WORKER`, default `5`

## Operating With The Dashboard

Once the frontend is running at `http://localhost:3000`, these are the main backend-powered flows:

### Overview Page

- `Quick Sample` creates a sample job
- `Claim Next` calls the claim endpoint for the active tenant
- `Run Worker` triggers one manual worker processing pass

### Submit Job Panel

- submit custom JSON payloads
- assign max attempts
- use post-submit controls to inspect, refresh, claim, ack, and fail the latest job

### Tenants Page

- create tenants from plans
- switch the active tenant API key stored in the browser

### Simulator Page

- bulk-create jobs for one tenant
- generate paced claim/ack/fail activity across multiple queues
- exercise retries, DLQ movement, and live event updates

### Settings Page

- confirm backend health
- inspect available API coverage
- review the current plan catalog

## Observability

- structured Nest logs for startup, requests, validation, auth failures, queue lifecycle, autoscaling, and worker activity
- `x-request-id` is accepted or generated and echoed back on responses
- `/metrics` exposes tenant-scoped totals
- WebSocket `job.status` events update the dashboard live
- `/events/jobs` provides SSE fallback

## Current Backend Scope

Implemented and wired into the dashboard:

- plans
- tenants
- jobs
- claim / ack / fail flow
- DLQ
- metrics
- autoscaling recommendations
- worker run-once and worker simulation
- WebSocket and SSE live events

Not currently exposed as dedicated backend APIs:

- schedules management and execution
- template CRUD and usage analytics
- alert rules, muting, acknowledgements, and alert history
- richer worker fleet telemetry such as CPU, memory, and zone health
- queue topology or subscriber graph endpoints beyond raw job events

## Troubleshooting

If the dashboard cannot connect:

- confirm this API is running on port `4000`
- confirm Postgres is running on port `5431`
- confirm migrations were applied successfully
- open the dashboard `Settings` page and verify backend status

If jobs do not move:

- use `Claim Next` or `Run Worker` from the dashboard
- or start the backend with `pnpm start:worker`
- check whether the active tenant hit its concurrency quota

If job creation fails:

- verify the tenant API key is valid
- verify the job does not exceed `max_allowed_attempts`
- verify the tenant is not rate-limited
- verify the idempotency key is not being reused with a different payload

## Validation

```bash
pnpm test
pnpm run build
pnpm exec prettier --check .
```
