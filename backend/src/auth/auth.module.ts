import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { DatabaseModule } from '../database/database.module';
import { ApiKeyGuard } from './api-key.guard';

@Module({
  imports: [DatabaseModule],

  providers: [AuthService, ApiKeyGuard],

  exports: [AuthService],
})
export class AuthModule {}
