import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { GET_AUTOSCALING_STATS_QUERY } from './autoscaling.queries';
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
      GET_AUTOSCALING_STATS_QUERY,
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
