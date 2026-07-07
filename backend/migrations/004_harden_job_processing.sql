CREATE UNIQUE INDEX IF NOT EXISTS dead_letter_jobs_job_id_unique
ON dead_letter_jobs(job_id);

CREATE INDEX IF NOT EXISTS jobs_tenant_status_created_idx
ON jobs(tenant_id, status, created_at);

CREATE INDEX IF NOT EXISTS jobs_running_lease_idx
ON jobs(tenant_id, lease_expires_at)
WHERE status='RUNNING';
