# Distributed Task Dashboard

Next.js dashboard for operating the distributed task queue backend. The UI can:

- auto-bootstrap a demo plan and tenant
- submit jobs with custom JSON payloads
- claim, inspect, ack, and fail jobs
- view queues, workers, DLQ, metrics, and live job updates
- create and switch tenants from the browser
- start worker simulations for demo traffic

## Prerequisites

- Node.js 20+ recommended
- npm
- the backend service from `../backend`

## Frontend Setup

Install dependencies:

```bash
npm install
```

Optional environment variables:

```bash
NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:4000
NEXT_PUBLIC_BACKEND_API_KEY=<optional-tenant-api-key>
BACKEND_BASE_URL=http://localhost:4000
BACKEND_API_KEY=<optional-tenant-api-key>
```

Notes:

- If `NEXT_PUBLIC_BACKEND_BASE_URL` is not set, the dashboard defaults to `http://localhost:4000`.
- If `BACKEND_BASE_URL` is not set, the server-side loader also tries to read `../backend/.env`.
- You usually do not need to pre-supply an API key because the dashboard can create a demo tenant for you.

## Run The Dashboard

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Production build commands:

```bash
npm run build
npm start
```

## Recommended End-To-End Startup

From the backend folder:

```bash
cd ../backend
pnpm install
docker compose up -d
psql "$DATABASE_URL" -f migrations/001_init.sql
psql "$DATABASE_URL" -f migrations/002_add_job_errors.sql
psql "$DATABASE_URL" -f migrations/003_create_dlq.sql
psql "$DATABASE_URL" -f migrations/004_harden_job_processing.sql
psql "$DATABASE_URL" -f migrations/005_convert_timestamps_to_timestamptz.sql
pnpm start:dev
```

From the dashboard folder in a second terminal:

```bash
npm install
npm run dev
```

## How The Dashboard Connects

When the dashboard loads and the backend is reachable, it:

1. Reads the backend base URL.
2. Checks whether a tenant API key already exists in browser local storage.
3. Creates a demo plan named `DASHBOARD_DEMO` if needed.
4. Creates a tenant if needed.
5. Seeds demo jobs for that tenant if the tenant has no jobs yet.
6. Loads jobs, metrics, DLQ data, autoscaling data, and health information.
7. Opens WebSocket updates with SSE fallback for live status changes.

The active tenant API key is stored in the browser, so refreshing the page keeps using the same tenant until you switch tenants.

## Operating The Dashboard

### Overview Page

- Use `Quick Sample` to create a sample job instantly.
- Use `Claim Next` to claim the next pending job with the dashboard worker id.
- Use `Run Worker` to let the backend process one worker pass.
- Use the refresh button to reload backend state.
- Use the environment, queue, and time filters to narrow the visible data.

### Submit Job

On the home page, the `Submit Job` panel lets you:

- provide an idempotency key
- set max attempts
- submit any JSON object as the payload
- load a sample payload

After submission, the panel also shows follow-up actions for the last job:

- `Inspect`
- `Refresh Job`
- `Claim Next`
- `Ack`
- `Fail`

Important behavior:

- `Claim Next` is available while the submitted job is still `PENDING`.
- `Ack` and `Fail` become available only when that job is `RUNNING` and leased by the dashboard worker.

### Jobs Page

Use the jobs table to:

- search by name or id
- filter by status and queue
- inspect job details
- ack or fail running jobs when the dashboard worker owns the lease

### Tenants Page

Use the `Tenants` page to:

- create a tenant from an existing plan
- review tenants returned by `GET /tenants`
- switch the active tenant used by the dashboard

Switching tenants updates the API key stored in local storage. Refresh the dashboard page after switching if you want all panels to reload under the selected tenant immediately.

### Simulator Page

Use `Simulator` to generate realistic demo traffic:

- choose a tenant
- set total jobs
- set worker count
- set failure rate
- set max attempts
- set job duration
- choose queue names

The simulator seeds jobs and produces paced claim/ack/fail events so the dashboard updates over time.

### Settings Page

Use `Settings` to inspect:

- backend health
- backend greeting
- integrated API list
- plan catalog

This is the best page for quickly confirming the dashboard is connected to the expected backend.

## Troubleshooting

If the dashboard does not show live data:

- make sure the backend is running on `http://localhost:4000` or update `NEXT_PUBLIC_BACKEND_BASE_URL`
- make sure Postgres is running on port `5431`
- confirm backend migrations were applied
- open the `Settings` page and verify backend health

If tenant creation or job submission fails:

- check the backend terminal for API or database errors
- make sure the current tenant plan allows the requested retry count and rate
- clear the browser local storage entry if you want to reset the stored tenant state

If WebSockets fail:

- the dashboard falls back to SSE or refresh-based updates
- check browser console and backend logs for CORS or connection errors

## Validation

```bash
npm run build
```
