import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { GET_DLQ_METRICS_QUERY, GET_JOB_METRICS_QUERY } from './metrics.queries';

@Injectable()
export class MetricsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getMetrics(tenantId: string) {
    const jobs = await this.databaseService.query(
      GET_JOB_METRICS_QUERY,
      [tenantId],
    );

    const dlq = await this.databaseService.query(
      GET_DLQ_METRICS_QUERY,
      [tenantId],
    );

    return {
      jobs: jobs.rows[0],

      dlq: dlq.rows[0],
    };
  }
}
