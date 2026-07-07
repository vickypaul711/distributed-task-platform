import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { FIND_ALL_DLQ_JOBS_QUERY } from './dlq.queries';

@Injectable()
export class DlqRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(tenantId: string) {
    const result = await this.databaseService.query(
      FIND_ALL_DLQ_JOBS_QUERY,
      [tenantId],
    );

    return result.rows;
  }
}
