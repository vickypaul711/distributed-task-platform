export const GET_AUTOSCALING_STATS_QUERY = `
  SELECT
    SUM(
      CASE
        WHEN status = 'PENDING' THEN 1
        ELSE 0
      END
    )::int AS pending_jobs,
    SUM(
      CASE
        WHEN status = 'RUNNING'
        AND lease_expires_at > NOW() THEN 1
        ELSE 0
      END
    )::int AS running_jobs,
    SUM(
      CASE
        WHEN status = 'RUNNING'
        AND lease_expires_at < NOW() THEN 1
        ELSE 0
      END
    )::int AS expired_leases,
    COUNT(
      DISTINCT CASE
        WHEN status = 'RUNNING'
        AND lease_owner IS NOT NULL
        AND lease_expires_at > NOW() THEN lease_owner
        ELSE NULL
      END
    )::int AS active_workers,
    (
      SELECT COUNT(*)::int
      FROM dead_letter_jobs
      WHERE tenant_id = $1
    ) AS dlq_jobs,
    COALESCE(
      EXTRACT(
        EPOCH FROM NOW() - MIN(
          CASE
            WHEN status = 'PENDING' THEN created_at
            ELSE NULL
          END
        )
      ),
      0
    )::int AS oldest_pending_job_age_seconds
  FROM jobs
  WHERE tenant_id = $1
`;
