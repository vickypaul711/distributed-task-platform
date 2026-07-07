import { Module } from '@nestjs/common';

import { MetricsService } from './metrics.service';

import { MetricsController } from './metrics.controller';

import { MetricsRepository } from './metrics.repository';

import { DatabaseModule } from '../database/database.module';

import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],

  controllers: [MetricsController],

  providers: [MetricsService, MetricsRepository],
})
export class MetricsModule {}
