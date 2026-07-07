import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseError } from 'pg';

import { withTimestamp } from '../common/logging/log-payload';
import { PlansRepository } from './plans.repository';

import { CreatePlanDto } from './plans.schema';

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(private readonly plansRepository: PlansRepository) {}

  async create(data: CreatePlanDto) {
    try {
      const plan = await this.plansRepository.create(data);

      this.logger.log(
        withTimestamp({
          event: 'PLAN_CREATED',
          planId: plan.id,
          name: plan.name,
        }),
      );

      return plan;
    } catch (error: unknown) {
      if (error instanceof DatabaseError && error.code === '23505') {
        this.logger.warn(
          withTimestamp({
            event: 'PLAN_CREATE_CONFLICT',
            name: data.name,
          }),
        );

        throw new ConflictException('Plan already exists');
      }

      this.logger.error(
        withTimestamp({
          event: 'PLAN_CREATE_FAILED',
          name: data.name,
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        error instanceof Error ? error.stack : undefined,
      );

      throw error;
    }
  }

  async finaAll() {
    try {
      const plans = await this.plansRepository.getAll();

      this.logger.log(
        withTimestamp({
          event: 'PLANS_LISTED',
          count: plans.length,
        }),
      );

      return plans;
    } catch (error) {
      this.logger.error(
        withTimestamp({
          event: 'PLANS_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        error instanceof Error ? error.stack : undefined,
      );

      throw new NotFoundException('No plans present');
    }
  }
}
