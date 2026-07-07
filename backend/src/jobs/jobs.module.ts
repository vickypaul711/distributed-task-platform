import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { JobsRepository } from './jobs.repository';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [DatabaseModule, AuthModule, RealtimeModule],

  controllers: [JobsController],

  providers: [JobsService, JobsRepository],

  exports: [JobsService, JobsRepository],
})
export class JobsModule {}
