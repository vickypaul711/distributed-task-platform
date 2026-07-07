import { Test, TestingModule } from '@nestjs/testing';

import { DatabaseService } from '../database/database.service';
import { AutoscalingRepository } from './autoscaling.repository';

describe('AutoscalingRepository', () => {
  let repository: AutoscalingRepository;
  let databaseService: {
    query: jest.Mock;
  };

  beforeEach(async () => {
    databaseService = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoscalingRepository,
        {
          provide: DatabaseService,
          useValue: databaseService,
        },
      ],
    }).compile();

    repository = module.get<AutoscalingRepository>(AutoscalingRepository);
  });

  it('should map queue stats from the database', async () => {
    databaseService.query.mockResolvedValue({
      rows: [
        {
          pending_jobs: 7,
          running_jobs: 2,
          expired_leases: 1,
          active_workers: 2,
          dlq_jobs: 3,
          oldest_pending_job_age_seconds: 45,
        },
      ],
    });

    await expect(repository.getStats('tenant-1')).resolves.toEqual({
      pendingJobs: 7,
      runningJobs: 2,
      expiredLeases: 1,
      activeWorkers: 2,
      dlqJobs: 3,
      oldestPendingJobAgeSeconds: 45,
    });
    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM jobs'),
      ['tenant-1'],
    );
  });

  it('should default oldest pending age to zero', async () => {
    databaseService.query.mockResolvedValue({
      rows: [
        {
          pending_jobs: 0,
          running_jobs: 0,
          expired_leases: 0,
          active_workers: 0,
          dlq_jobs: 0,
          oldest_pending_job_age_seconds: null,
        },
      ],
    });

    await expect(repository.getStats('tenant-1')).resolves.toEqual(
      expect.objectContaining({
        oldestPendingJobAgeSeconds: 0,
      }),
    );
  });
});
