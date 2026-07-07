export const CREATE_TENANT_QUERY = `
  INSERT INTO tenants
  (
    name,
    api_key,
    plan_id
  )
  VALUES
  (
    $1,
    $2,
    $3
  )
  RETURNING
    id,
    name,
    api_key,
    plan_id
`;

const TENANT_WITH_PLAN_FIELDS = `
  tenants.id,
  tenants.name,
  tenants.api_key,
  tenants.plan_id,
  tenants.created_at,
  plans.name AS plan_name,
  plans.rate_limit_per_minute,
  plans.max_concurrent_jobs,
  plans.default_max_attempts,
  plans.max_allowed_attempts
`;

export const FIND_ALL_TENANTS_QUERY = `
  SELECT
    ${TENANT_WITH_PLAN_FIELDS}
  FROM tenants
  INNER JOIN plans
    ON plans.id = tenants.plan_id
  ORDER BY tenants.created_at DESC
`;

export const FIND_TENANT_BY_ID_QUERY = `
  SELECT
    ${TENANT_WITH_PLAN_FIELDS}
  FROM tenants
  INNER JOIN plans
    ON plans.id = tenants.plan_id
  WHERE tenants.id = $1
`;
