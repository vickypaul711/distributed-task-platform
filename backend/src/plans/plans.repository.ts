import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

import { CreatePlanDto } from './plans.schema';

@Injectable()
export class PlansRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(data: CreatePlanDto) {
    const result = await this.databaseService.query(
      `
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
        `,
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
    const result = await this.databaseService.query(
      `
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
      `,
    );
    return result.rows;
  }
}
