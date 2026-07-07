import { Controller, Get, UseGuards } from '@nestjs/common';

import { DlqService } from './dlq.service';

import { ApiKeyGuard } from '../auth/api-key.guard';

import { Tenant } from '../auth/tenant.decorator';

import * as authTypes from '../auth/auth.types';

@Controller('dlq')
@UseGuards(ApiKeyGuard)
export class DlqController {
  constructor(private readonly dlqService: DlqService) {}

  @Get()
  findAll(
    @Tenant()
    tenant: authTypes.Tenant,
  ) {
    return this.dlqService.findAll(tenant.id);
  }
}
