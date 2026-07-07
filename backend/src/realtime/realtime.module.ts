import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { JobEventsGateway } from './job-events.gateway';
import { JobEventsService } from './job-events.service';
import { RealtimeController } from './realtime.controller';

@Module({
  imports: [AuthModule],

  controllers: [RealtimeController],

  providers: [JobEventsService, JobEventsGateway],

  exports: [JobEventsService],
})
export class RealtimeModule {}
