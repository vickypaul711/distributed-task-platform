import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { Tenant } from '../auth/auth.types';
import { JobsRepository } from '../jobs/jobs.repository';
import { JobsService } from '../jobs/jobs.service';
import { WorkerService } from './worker.service';

describe('WorkerService', () => {
  let service: WorkerService;
  let jobsService: {
    findRunnableTenants: jest.Mock;
    claim: jest.Mock;
    ack: jest.Mock;
    fail: jest.Mock;
  };
  let jobsRepository: {
    bulkCreateSimulationJobs: jest.Mock;
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
    jest.spyOn(Logger.prototype, 'log').mockImplementation();

    jobsService = {
      findRunnableTenants: jest.fn(),
      claim: jest.fn(),
      ack: jest.fn(),
      fail: jest.fn(),
    };

    jobsRepository = {
      bulkCreateSimulationJobs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkerService,
        {
          provide: JobsService,
          useValue: jobsService,
        },
        {
          provide: JobsRepository,
          useValue: jobsRepository,
        },
      ],
    }).compile();

    service = module.get<WorkerService>(WorkerService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.WORKER_ENABLED;
  });

  it('should claim and ack runnable jobs', async () => {
    jobsService.findRunnableTenants.mockResolvedValue([tenant]);
    jobsService.claim.mockResolvedValue({
      id: 'job-1',
      payload: {},
    });

    await expect(service.processOnce()).resolves.toEqual({
      claimed: 1,
      skipped: false,
    });
    expect(jobsService.ack).toHaveBeenCalledWith(
      tenant,
      'job-1',
      expect.stringMatching(/^worker-/),
    );
  });

  it('should fail jobs when execution throws', async () => {
    jobsService.findRunnableTenants.mockResolvedValue([tenant]);
    jobsService.claim.mockResolvedValue({
      id: 'job-1',
      payload: {
        simulateFailure: true,
      },
    });

    await service.processOnce();

    expect(jobsService.fail).toHaveBeenCalledWith(
      tenant,
      'job-1',
      expect.stringMatching(/^worker-/),
      'Simulated job failure',
    );
  });

  it('should skip when there are no runnable jobs', async () => {
    jobsService.findRunnableTenants.mockResolvedValue([]);

    await expect(service.processOnce()).resolves.toEqual({
      claimed: 0,
      skipped: false,
    });
  });

  it('should seed jobs and start a paced simulation', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.9);
    jest.spyOn(service as never, 'wait').mockResolvedValue(undefined);
    jobsRepository.bulkCreateSimulationJobs.mockResolvedValue(2);
    jobsService.claim
      .mockResolvedValueOnce({ id: 'job-1', payload: {} })
      .mockResolvedValueOnce({ id: 'job-2', payload: {} })
      .mockResolvedValue(null);

    const simulation = await service.startSimulation(tenant, {
      jobCount: 2,
      workerCount: 1,
      failureRatePercent: 20,
      maxAttempts: 3,
      jobDurationMs: 0,
      queueNames: ['default'],
    });

    expect(simulation.seededJobs).toBe(2);
    expect(jobsRepository.bulkCreateSimulationJobs).toHaveBeenCalledWith(
      tenant.id,
      2,
      ['default'],
      0,
      3,
      expect.stringContaining(tenant.id),
    );

    await new Promise((resolve) => setImmediate(resolve));

    expect(jobsService.ack).toHaveBeenCalledTimes(2);
  });
});
