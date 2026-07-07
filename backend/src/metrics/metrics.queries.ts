export const GET_JOB_METRICS_QUERY = `
  SELECT
    COUNT(*)::int total,
    COUNT(*)
    FILTER (
      WHERE status = 'PENDING'
    )::int pending,
    COUNT(*)
    FILTER (
      WHERE status = 'RUNNING'
    )::int running,
    COUNT(*)
    FILTER (
      WHERE status = 'SUCCESS'
    )::int success,
    COUNT(*)
    FILTER (
      WHERE status IN ('FAILED', 'DLQ')
    )::int failed
  FROM jobs
  WHERE tenant_id = $1
`;

export const GET_DLQ_METRICS_QUERY = `
  SELECT
    COUNT(*)::int total
  FROM dead_letter_jobs
  WHERE tenant_id = $1
`;
