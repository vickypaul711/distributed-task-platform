import { Injectable, Logger } from '@nestjs/common';

import { randomUUID } from 'crypto';

import { withTimestamp } from '../common/logging/log-payload';
import { TenantsRepository } from './tenants.repository';

import { CreateTenantDto } from './tenants.schema';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(private readonly tenantsRepository: TenantsRepository) {}

  async create(data: CreateTenantDto) {
    const apiKey = `tq_${randomUUID()}`;

    const tenant = await this.tenantsRepository.create(data, apiKey);

    this.logger.log(
      withTimestamp({
        event: 'TENANT_CREATED',
        tenantId: tenant.id,
        planId: tenant.plan_id,
      }),
    );

    return tenant;
  }

  async findAll() {
    return this.tenantsRepository.findAll();
  }

  async findById(id: string) {
    return this.tenantsRepository.findById(id);
  }
}
