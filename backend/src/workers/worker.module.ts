import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { JobsModule } from '../jobs/jobs.module';
import { TenantsModule } from '../tenants/tenants.module';
import { WorkerController } from './worker.controller';
import { WorkerService } from './worker.service';

@Module({
  imports: [JobsModule, AuthModule, TenantsModule],

  controllers: [WorkerController],

  providers: [WorkerService],
})
export class WorkerModule {}
