import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { ApiKeyGuard } from '../auth/api-key.guard';
import { Tenant } from '../auth/tenant.decorator';
import type { Tenant as TenantType } from '../auth/auth.types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { WorkerService } from './worker.service';
import * as workerSchema from './worker.schema';

@Controller('workers')
@UseGuards(ApiKeyGuard)
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  @Post('run-once')
  runOnce(
    @Tenant()
    tenant: TenantType,
  ) {
    return this.workerService.processTenantOnce(tenant);
  }

  @Post('simulate')
  simulate(
    @Tenant()
    tenant: TenantType,
    @Body(new ZodValidationPipe(workerSchema.SimulateWorkersSchema))
    body: workerSchema.SimulateWorkersDto,
  ) {
    return this.workerService.startSimulation(tenant, body);
  }
}
