import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

import { CreateTenantDto } from './tenants.schema';

@Injectable()
export class TenantsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(data: CreateTenantDto, apiKey: string) {
    const result = await this.databaseService.query(
      `
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
        `,
      [data.name, apiKey, data.planId],
    );

    return result.rows[0];
  }

  async findAll() {
    const result = await this.databaseService.query(
      `
        SELECT
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
        FROM tenants
        INNER JOIN plans
          ON plans.id = tenants.plan_id
        ORDER BY tenants.created_at DESC
      `,
    );

    return result.rows;
  }

  async findById(id: string) {
    const result = await this.databaseService.query(
      `
        SELECT
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
        FROM tenants
        INNER JOIN plans
          ON plans.id = tenants.plan_id
        WHERE tenants.id = $1
      `,
      [id],
    );

    return result.rows[0] ?? null;
  }
}
