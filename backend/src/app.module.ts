import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { JobsModule } from './jobs/jobs.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { PlansModule } from './plans/plans.module';
import { DlqModule } from './dlq/dlq.module';
import { MetricsModule } from './metrics/metrics.module';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
import { AutoscalingModule } from './autoscaling/autoscaling.module';
import { RealtimeModule } from './realtime/realtime.module';
import { WorkerModule } from './workers/worker.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    JobsModule,
    AuthModule,
    TenantsModule,
    PlansModule,
    DlqModule,
    MetricsModule,
    AutoscalingModule,
    RealtimeModule,
    WorkerModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
  ],
})
export class AppModule {}
