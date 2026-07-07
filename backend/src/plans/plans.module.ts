import { Module } from '@nestjs/common';

import { PlansService } from './plans.service';

import { PlansController } from './plans.controller';

import { PlansRepository } from './plans.repository';

import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],

  controllers: [PlansController],

  providers: [PlansService, PlansRepository],
})
export class PlansModule {}
