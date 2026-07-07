import { Controller, Get, UseGuards } from '@nestjs/common';

import { MetricsService } from './metrics.service';

import { ApiKeyGuard } from '../auth/api-key.guard';

import { Tenant } from '../auth/tenant.decorator';

import type { Tenant as TenantType } from '../auth/auth.types';

@Controller('metrics')
@UseGuards(ApiKeyGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  getMetrics(
    @Tenant()
    tenant: TenantType,
  ) {
    return this.metricsService.getMetrics(tenant.id);
  }
}
