export const VALIDATE_API_KEY_QUERY = `
  SELECT
    t.id,
    t.name,
    p.rate_limit_per_minute,
    p.max_concurrent_jobs,
    p.default_max_attempts,
    p.max_allowed_attempts
  FROM tenants t
  JOIN plans p
    ON p.id = t.plan_id
  WHERE t.api_key = $1
`;
