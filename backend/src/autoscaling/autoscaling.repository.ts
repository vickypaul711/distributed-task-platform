import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { AutoscalingStats } from './autoscaling.types';

type AutoscalingStatsRow = {
  pending_jobs: number;
  running_jobs: number;
  expired_leases: number;
  active_workers: number;
  dlq_jobs: number;
  oldest_pending_job_age_seconds: number | null;
};

@Injectable()
export class AutoscalingRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getStats(tenantId: string): Promise<AutoscalingStats> {
    const result = await this.databaseService.query<AutoscalingStatsRow>(
      `
        SELECT
          SUM(
            CASE
              WHEN status='PENDING' THEN 1
              ELSE 0
            END
          )::int AS pending_jobs,

          SUM(
            CASE
              WHEN status='RUNNING'
              AND lease_expires_at > NOW() THEN 1
              ELSE 0
            END
          )::int AS running_jobs,

          SUM(
            CASE
              WHEN status='RUNNING'
              AND lease_expires_at < NOW() THEN 1
              ELSE 0
            END
          )::int AS expired_leases,

          COUNT(
            DISTINCT CASE
              WHEN status='RUNNING'
              AND lease_owner IS NOT NULL
              AND lease_expires_at > NOW() THEN lease_owner
              ELSE NULL
            END
          )::int AS active_workers,

          (
            SELECT COUNT(*)::int
            FROM dead_letter_jobs
            WHERE tenant_id=$1
          ) AS dlq_jobs,

          COALESCE(
            EXTRACT(
              EPOCH FROM NOW() - MIN(
                CASE
                  WHEN status='PENDING' THEN created_at
                  ELSE NULL
                END
              )
            ),
            0
          )::int AS oldest_pending_job_age_seconds

        FROM jobs

        WHERE tenant_id=$1
        `,
      [tenantId],
    );

    const stats = result.rows[0];

    return {
      pendingJobs: stats.pending_jobs,
      runningJobs: stats.running_jobs,
      expiredLeases: stats.expired_leases,
      activeWorkers: stats.active_workers,
      dlqJobs: stats.dlq_jobs,
      oldestPendingJobAgeSeconds: stats.oldest_pending_job_age_seconds ?? 0,
    };
  }
}
