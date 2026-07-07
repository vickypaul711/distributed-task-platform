import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { AutoscalingController } from './autoscaling.controller';
import { AutoscalingRepository } from './autoscaling.repository';
import { AutoscalingService } from './autoscaling.service';

@Module({
  imports: [DatabaseModule, AuthModule],

  controllers: [AutoscalingController],

  providers: [AutoscalingService, AutoscalingRepository],
})
export class AutoscalingModule {}
