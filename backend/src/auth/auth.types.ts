export interface Tenant {
  id: string;

  name: string;

  rate_limit_per_minute: number;

  max_concurrent_jobs: number;

  default_max_attempts: number;

  max_allowed_attempts: number;
}
