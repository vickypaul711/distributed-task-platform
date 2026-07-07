import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

import {
  CREATE_TENANT_QUERY,
  FIND_ALL_TENANTS_QUERY,
  FIND_TENANT_BY_ID_QUERY,
} from './tenants.queries';
import { CreateTenantDto } from './tenants.schema';

@Injectable()
export class TenantsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(data: CreateTenantDto, apiKey: string) {
    const result = await this.databaseService.query(
      CREATE_TENANT_QUERY,
      [data.name, apiKey, data.planId],
    );

    return result.rows[0];
  }

  async findAll() {
    const result = await this.databaseService.query(FIND_ALL_TENANTS_QUERY);

    return result.rows;
  }

  async findById(id: string) {
    const result = await this.databaseService.query(FIND_TENANT_BY_ID_QUERY, [id]);

    return result.rows[0] ?? null;
  }
}
