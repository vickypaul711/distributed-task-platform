import { Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

import { JobEventsService } from './job-events.service';

describe('JobEventsService', () => {
  let service: JobEventsService;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    service = new JobEventsService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should stream events for a tenant', async () => {
    const eventPromise = firstValueFrom(service.streamForTenant('tenant-1'));

    service.emit({
      type: 'JOB_CREATED',
      tenantId: 'tenant-1',
      jobId: 'job-1',
      status: 'PENDING',
    });

    await expect(eventPromise).resolves.toEqual(
      expect.objectContaining({
        type: 'JOB_CREATED',
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          jobId: 'job-1',
          occurredAt: expect.any(String),
        }),
      }),
    );
  });

  it('should stream all events', async () => {
    const eventPromise = firstValueFrom(service.streamAll());

    service.emit({
      type: 'JOB_ACKED',
      tenantId: 'tenant-1',
      jobId: 'job-1',
      status: 'SUCCESS',
    });

    await expect(eventPromise).resolves.toEqual(
      expect.objectContaining({
        type: 'JOB_ACKED',
        tenantId: 'tenant-1',
      }),
    );
  });
});
