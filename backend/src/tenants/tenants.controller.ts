import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { TenantsService } from './tenants.service';

import * as tenantsSchema from './tenants.schema';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.tenantsService.findById(id);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(tenantsSchema.CreateTenantSchema))
    body: tenantsSchema.CreateTenantDto,
  ) {
    return this.tenantsService.create(body);
  }
}
