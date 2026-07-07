import { Controller, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';

import { ApiKeyGuard } from '../auth/api-key.guard';
import { Tenant } from '../auth/tenant.decorator';
import type { Tenant as TenantType } from '../auth/auth.types';
import { JobEventsService } from './job-events.service';

@Controller('events')
@UseGuards(ApiKeyGuard)
export class RealtimeController {
  constructor(private readonly jobEventsService: JobEventsService) {}

  @Sse('jobs')
  streamJobs(
    @Tenant()
    tenant: TenantType,
  ): Observable<MessageEvent> {
    return this.jobEventsService.streamForTenant(tenant.id);
  }
}
