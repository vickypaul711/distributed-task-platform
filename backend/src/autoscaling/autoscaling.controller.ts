import { Controller, Get, UseGuards } from '@nestjs/common';

import { ApiKeyGuard } from '../auth/api-key.guard';
import { Tenant } from '../auth/tenant.decorator';
import type { Tenant as TenantType } from '../auth/auth.types';
import { AutoscalingService } from './autoscaling.service';

@Controller('autoscaling')
@UseGuards(ApiKeyGuard)
export class AutoscalingController {
  constructor(private readonly autoscalingService: AutoscalingService) {}

  @Get('recommendation')
  getRecommendation(
    @Tenant()
    tenant: TenantType,
  ) {
    return this.autoscalingService.getRecommendation(tenant);
  }
}
