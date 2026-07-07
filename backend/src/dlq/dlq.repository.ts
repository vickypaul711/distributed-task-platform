import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

@Injectable()
export class DlqRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(tenantId: string) {
    const result = await this.databaseService.query(
      `
        SELECT

          id,
          job_id,
          payload,
          reason,
          failed_at

        FROM dead_letter_jobs

        WHERE tenant_id=$1

        ORDER BY failed_at DESC
        `,
      [tenantId],
    );

    return result.rows;
  }
}
