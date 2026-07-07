export const CREATE_PLAN_QUERY = `
  INSERT INTO plans
  (
    name,
    rate_limit_per_minute,
    max_concurrent_jobs,
    default_max_attempts,
    max_allowed_attempts
  )
  VALUES
  (
    $1,
    $2,
    $3,
    $4,
    $5
  )
  RETURNING
    id,
    name,
    rate_limit_per_minute,
    max_concurrent_jobs,
    default_max_attempts,
    max_allowed_attempts
`;

export const GET_ALL_PLANS_QUERY = `
  SELECT
    id,
    name,
    rate_limit_per_minute,
    max_concurrent_jobs,
    default_max_attempts,
    max_allowed_attempts,
    created_at
  FROM plans
  ORDER BY created_at ASC
`;
