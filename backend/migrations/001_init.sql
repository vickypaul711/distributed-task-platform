CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


CREATE TYPE job_status AS ENUM (
    'PENDING',
    'RUNNING',
    'SUCCESS',
    'FAILED',
    'DLQ'
);

CREATE TABLE plans (

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name TEXT UNIQUE NOT NULL,

    rate_limit_per_minute INT NOT NULL,

    max_concurrent_jobs INT NOT NULL,

    default_max_attempts INT NOT NULL,

    max_allowed_attempts INT NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()

);


CREATE TABLE tenants (

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name TEXT NOT NULL,

    api_key TEXT UNIQUE NOT NULL,

    plan_id UUID NOT NULL REFERENCES plans(id),

    created_at TIMESTAMPTZ DEFAULT NOW()

);


CREATE TABLE jobs (

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    tenant_id UUID NOT NULL REFERENCES tenants(id),

    payload JSONB NOT NULL,

    status job_status NOT NULL DEFAULT 'PENDING',

    attempt_count INT NOT NULL DEFAULT 0,

    max_attempts INT NOT NULL DEFAULT 3,


    idempotency_key TEXT NOT NULL,


    lease_owner TEXT,

    lease_expires_at TIMESTAMPTZ,


    created_at TIMESTAMPTZ DEFAULT NOW(),

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,


    UNIQUE(
        tenant_id,
        idempotency_key
    )
);


CREATE TABLE job_attempts (

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    job_id UUID NOT NULL REFERENCES jobs(id),

    worker_id TEXT,

    attempt_number INT NOT NULL,

    error TEXT,

    started_at TIMESTAMPTZ DEFAULT NOW(),

    finished_at TIMESTAMPTZ
);
