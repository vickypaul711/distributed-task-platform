CREATE TABLE dead_letter_jobs (

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),


    job_id UUID NOT NULL REFERENCES jobs(id),


    tenant_id UUID NOT NULL REFERENCES tenants(id),


    payload JSONB NOT NULL,


    reason TEXT,


    failed_at TIMESTAMPTZ DEFAULT NOW()

);
