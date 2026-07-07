import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpException, Logger } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsRepository } from './jobs.repository';
import { Tenant } from '../auth/auth.types';

describe('JobsService', () => {
  let service: JobsService;
  let jobsRepository: {
    countRecentJobs: jest.Mock;
    create: jest.Mock;
    findById: jest.Mock;
    findAll: jest.Mock;
    claim: jest.Mock;
    ack: jest.Mock;
    fail: jest.Mock;
    findRunnableTenants: jest.Mock;
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
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();

    jobsRepository = {
      countRecentJobs: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      claim: jest.fn(),
      ack: jest.fn(),
      fail: jest.fn(),
      findRunnableTenants: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        {
          provide: JobsRepository,
          useValue: jobsRepository,
        },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a job with tenant default attempts', async () => {
    jobsRepository.create.mockResolvedValue({
      job: { id: 'job-1', status: 'PENDING' },
      idempotencyReplay: false,
      idempotencyConflict: false,
      rateLimited: false,
      recentJobs: 0,
    });

    await expect(
      service.create(tenant, {
        idempotencyKey: 'abcde',
        payload: { hello: 'world' },
      }),
    ).resolves.toEqual({ id: 'job-1', status: 'PENDING' });

    expect(jobsRepository.create).toHaveBeenCalledWith(
      tenant.id,
      {
        idempotencyKey: 'abcde',
        payload: { hello: 'world' },
        maxAttempts: tenant.default_max_attempts,
      },
      tenant.rate_limit_per_minute,
    );
  });

  it('should reject job creation when rate limited', async () => {
    jobsRepository.create.mockResolvedValue({
      job: null,
      idempotencyReplay: false,
      idempotencyConflict: false,
      rateLimited: true,
      recentJobs: tenant.rate_limit_per_minute,
    });

    await expect(
      service.create(tenant, {
        idempotencyKey: 'abcde',
        payload: {},
      }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(jobsRepository.create).toHaveBeenCalledTimes(1);
  });

  it('should reject idempotency conflicts', async () => {
    jobsRepository.create.mockResolvedValue({
      job: null,
      idempotencyReplay: false,
      idempotencyConflict: true,
      rateLimited: false,
      recentJobs: 1,
    });

    await expect(
      service.create(tenant, {
        idempotencyKey: 'abcde',
        payload: {},
      }),
    ).rejects.toThrow('Idempotency key already exists');
  });

  it('should reject job creation when max attempts exceed plan', async () => {
    await expect(
      service.create(tenant, {
        idempotencyKey: 'abcde',
        payload: {},
        maxAttempts: tenant.max_allowed_attempts + 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(jobsRepository.create).not.toHaveBeenCalled();
  });

  it('should return null and log when job is not found', async () => {
    jobsRepository.findById.mockResolvedValue(null);

    await expect(service.findById(tenant, 'job-1')).resolves.toBeNull();
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'JOB_NOT_FOUND',
        jobId: 'job-1',
        tenantId: tenant.id,
      }),
    );
  });

  it('should list tenant jobs', async () => {
    jobsRepository.findAll.mockResolvedValue([{ id: 'job-1' }]);

    await expect(service.findAll(tenant, 'PENDING')).resolves.toEqual([
      { id: 'job-1' },
    ]);
    expect(jobsRepository.findAll).toHaveBeenCalledWith(tenant.id, 'PENDING');
  });

  it('should return claimed jobs', async () => {
    jobsRepository.claim.mockResolvedValue({ id: 'job-1' });

    await expect(service.claim(tenant, 'worker-1')).resolves.toEqual({
      id: 'job-1',
    });
    expect(jobsRepository.claim).toHaveBeenCalledWith(
      tenant.id,
      'worker-1',
      tenant.max_concurrent_jobs,
    );
  });

  it('should return null when no job can be claimed', async () => {
    jobsRepository.claim.mockResolvedValue(null);

    await expect(service.claim(tenant, 'worker-1')).resolves.toBeNull();
    expect(Logger.prototype.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'JOB_CLAIM_SKIPPED',
        tenantId: tenant.id,
      }),
    );
  });

  it('should ack running jobs', async () => {
    jobsRepository.ack.mockResolvedValue({ id: 'job-1', status: 'SUCCESS' });

    await expect(service.ack(tenant, 'job-1', 'worker-1')).resolves.toEqual({
      id: 'job-1',
      status: 'SUCCESS',
    });
    expect(jobsRepository.ack).toHaveBeenCalledWith(
      tenant.id,
      'job-1',
      'worker-1',
    );
  });

  it('should warn when ack is rejected', async () => {
    jobsRepository.ack.mockResolvedValue(null);

    await expect(service.ack(tenant, 'job-1', 'worker-1')).resolves.toBeNull();
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'JOB_ACK_REJECTED',
        jobId: 'job-1',
        tenantId: tenant.id,
      }),
    );
  });

  it('should fail running jobs', async () => {
    jobsRepository.fail.mockResolvedValue({
      id: 'job-1',
      status: 'PENDING',
      attempt_count: 1,
    });

    await expect(
      service.fail(tenant, 'job-1', 'worker-1', 'boom'),
    ).resolves.toEqual({
      id: 'job-1',
      status: 'PENDING',
      attempt_count: 1,
    });
  });

  it('should require worker ids for claims', async () => {
    await expect(service.claim(tenant, '')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
