import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { Tenant } from '../auth/auth.types';
import { AutoscalingRepository } from './autoscaling.repository';
import { AutoscalingService } from './autoscaling.service';
import { AutoscalingStats } from './autoscaling.types';

describe('AutoscalingService', () => {
  let service: AutoscalingService;
  let autoscalingRepository: {
    getStats: jest.Mock;
  };

  const tenant: Tenant = {
    id: 'tenant-1',
    name: 'Acme',
    rate_limit_per_minute: 10,
    max_concurrent_jobs: 4,
    default_max_attempts: 3,
    max_allowed_attempts: 5,
  };

  const stats: AutoscalingStats = {
    pendingJobs: 0,
    runningJobs: 0,
    expiredLeases: 0,
    activeWorkers: 0,
    dlqJobs: 0,
    oldestPendingJobAgeSeconds: 0,
  };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();

    autoscalingRepository = {
      getStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoscalingService,
        {
          provide: AutoscalingRepository,
          useValue: autoscalingRepository,
        },
      ],
    }).compile();

    service = module.get<AutoscalingService>(AutoscalingService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.AUTOSCALING_MIN_WORKERS;
    delete process.env.AUTOSCALING_MAX_WORKERS;
    delete process.env.AUTOSCALING_TARGET_JOBS_PER_WORKER;
  });

  it('should recommend scale out when backlog exceeds active workers', async () => {
    process.env.AUTOSCALING_TARGET_JOBS_PER_WORKER = '5';
    autoscalingRepository.getStats.mockResolvedValue({
      ...stats,
      pendingJobs: 11,
      activeWorkers: 1,
    });

    await expect(service.getRecommendation(tenant)).resolves.toEqual(
      expect.objectContaining({
        decision: 'SCALE_OUT',
        desiredWorkerCount: 3,
        currentWorkerCount: 1,
        maxWorkerCount: 4,
      }),
    );
  });

  it('should cap desired workers at tenant concurrency', async () => {
    process.env.AUTOSCALING_TARGET_JOBS_PER_WORKER = '1';
    process.env.AUTOSCALING_MAX_WORKERS = '20';
    autoscalingRepository.getStats.mockResolvedValue({
      ...stats,
      pendingJobs: 25,
    });

    const recommendation = await service.getRecommendation(tenant);

    expect(recommendation.desiredWorkerCount).toBe(tenant.max_concurrent_jobs);
    expect(recommendation.reasons).toContain(
      'desired workers capped by tenant or autoscaling limit',
    );
  });

  it('should recommend scale in when there is no backlog', async () => {
    autoscalingRepository.getStats.mockResolvedValue({
      ...stats,
      activeWorkers: 3,
    });

    await expect(service.getRecommendation(tenant)).resolves.toEqual(
      expect.objectContaining({
        decision: 'SCALE_IN',
        desiredWorkerCount: 0,
        currentWorkerCount: 3,
      }),
    );
  });

  it('should hold when active workers already match desired workers', async () => {
    process.env.AUTOSCALING_TARGET_JOBS_PER_WORKER = '5';
    autoscalingRepository.getStats.mockResolvedValue({
      ...stats,
      pendingJobs: 10,
      activeWorkers: 2,
    });

    await expect(service.getRecommendation(tenant)).resolves.toEqual(
      expect.objectContaining({
        decision: 'HOLD',
        desiredWorkerCount: 2,
        currentWorkerCount: 2,
      }),
    );
  });

  it('should count expired leases as backlog', async () => {
    process.env.AUTOSCALING_TARGET_JOBS_PER_WORKER = '2';
    autoscalingRepository.getStats.mockResolvedValue({
      ...stats,
      expiredLeases: 3,
      activeWorkers: 0,
    });

    await expect(service.getRecommendation(tenant)).resolves.toEqual(
      expect.objectContaining({
        decision: 'SCALE_OUT',
        desiredWorkerCount: 2,
      }),
    );
  });
});
