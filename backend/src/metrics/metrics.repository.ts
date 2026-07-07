import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

@Injectable()
export class MetricsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getMetrics(tenantId: string) {
    const jobs = await this.databaseService.query(
      `
        SELECT

          COUNT(*)::int total,


          COUNT(*)
          FILTER(
            WHERE status='PENDING'
          )::int pending,


          COUNT(*)
          FILTER(
            WHERE status='RUNNING'
          )::int running,


          COUNT(*)
          FILTER(
            WHERE status='SUCCESS'
          )::int success,


          COUNT(*)
          FILTER(
            WHERE status IN ('FAILED', 'DLQ')
          )::int failed


        FROM jobs


        WHERE tenant_id=$1
        `,
      [tenantId],
    );

    const dlq = await this.databaseService.query(
      `
        SELECT

          COUNT(*)::int total


        FROM dead_letter_jobs


        WHERE tenant_id=$1
        `,
      [tenantId],
    );

    return {
      jobs: jobs.rows[0],

      dlq: dlq.rows[0],
    };
  }
}
