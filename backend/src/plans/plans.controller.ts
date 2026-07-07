import { Body, Controller, Get, Post } from '@nestjs/common';

import { PlansService } from './plans.service';

import * as plansSchema from './plans.schema';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(plansSchema.CreatePlanSchema))
    body: plansSchema.CreatePlanDto,
  ) {
    return this.plansService.create(body);
  }

  @Get()
  findAll() {
    return this.plansService.finaAll();
  }
}
