import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JobsService } from './jobs.service';
import * as jobsSchema from './jobs.schema';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { Tenant } from '../auth/tenant.decorator';
import type { Tenant as TenantType } from 'src/auth/auth.types';

@Controller('jobs')
@UseGuards(ApiKeyGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  create(
    @Tenant()
    tenant: TenantType,
    @Body(new ZodValidationPipe(jobsSchema.CreateJobSchema))
    body: jobsSchema.CreateJobDto,
  ) {
    return this.jobsService.create(tenant, body);
  }

  @Post('claim')
  claim(
    @Tenant()
    tenant: TenantType,

    @Headers('x-worker-id')
    workerId: string,
  ) {
    return this.jobsService.claim(tenant, workerId);
  }

  @Post(':id/ack')
  ack(
    @Tenant()
    tenant: TenantType,

    @Param('id', ParseUUIDPipe)
    jobId: string,

    @Headers('x-worker-id')
    workerId: string,
  ) {
    return this.jobsService.ack(tenant, jobId, workerId);
  }

  @Post(':id/fail')
  fail(
    @Tenant()
    tenant: TenantType,

    @Param('id', ParseUUIDPipe)
    jobId: string,

    @Headers('x-worker-id')
    workerId: string,

    @Body('reason')
    reason: string,
  ) {
    return this.jobsService.fail(tenant, jobId, workerId, reason);
  }

  @Get(':id')
  find(
    @Tenant()
    tenant: TenantType,

    @Param('id')
    id: string,
  ) {
    return this.jobsService.findById(tenant, id);
  }

  @Get()
  findAll(
    @Tenant()
    tenant: TenantType,

    @Query('status')
    status?: string,
  ) {
    return this.jobsService.findAll(tenant, status);
  }
}
