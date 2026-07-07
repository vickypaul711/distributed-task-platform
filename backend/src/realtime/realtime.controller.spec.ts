import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';

import { ApiKeyGuard } from '../auth/api-key.guard';
import { Tenant } from '../auth/auth.types';
import { JobEventsService } from './job-events.service';
import { RealtimeController } from './realtime.controller';

describe('RealtimeController', () => {
  let controller: RealtimeController;
  let jobEventsService: {
    streamForTenant: jest.Mock;
  };

  const tenant: Tenant = {
    id: 'tenant-1',
    name: 'Acme',
    rate_limit_per_minute: 10,
    max_concurrent_jobs: 2,
    default_max_attempts: 3,
    max_allowed_attempts: 5,
  };

  beforeEach(async () => {
    jobEventsService = {
      streamForTenant: jest.fn().mockReturnValue(of()),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RealtimeController],
      providers: [
        {
          provide: JobEventsService,
          useValue: jobEventsService,
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<RealtimeController>(RealtimeController);
  });

  it('should stream job events for the tenant', () => {
    controller.streamJobs(tenant);

    expect(jobEventsService.streamForTenant).toHaveBeenCalledWith(tenant.id);
  });
});
