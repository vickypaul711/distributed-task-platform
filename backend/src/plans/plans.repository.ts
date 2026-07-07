import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

import { CREATE_PLAN_QUERY, GET_ALL_PLANS_QUERY } from './plans.queries';
import { CreatePlanDto } from './plans.schema';

@Injectable()
export class PlansRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(data: CreatePlanDto) {
    const result = await this.databaseService.query(
      CREATE_PLAN_QUERY,
      [
        data.name,
        data.rateLimitPerMinute,
        data.maxConcurrentJobs,
        data.defaultMaxAttempts,
        data.maxAllowedAttempts,
      ],
    );

    return result.rows[0];
  }

  async getAll() {
    const result = await this.databaseService.query(GET_ALL_PLANS_QUERY);
    return result.rows;
  }
}
