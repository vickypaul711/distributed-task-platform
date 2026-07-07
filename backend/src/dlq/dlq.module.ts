import { Module } from '@nestjs/common';

import { DlqService } from './dlq.service';

import { DlqController } from './dlq.controller';

import { DlqRepository } from './dlq.repository';

import { DatabaseModule } from '../database/database.module';

import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],

  controllers: [DlqController],

  providers: [DlqService, DlqRepository],
})
export class DlqModule {}
