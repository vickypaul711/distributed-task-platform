export const FIND_ALL_DLQ_JOBS_QUERY = `
  SELECT
    id,
    job_id,
    payload,
    reason,
    failed_at
  FROM dead_letter_jobs
  WHERE tenant_id = $1
  ORDER BY failed_at DESC
`;
