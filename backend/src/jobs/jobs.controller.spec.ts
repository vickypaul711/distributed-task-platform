import { Test, TestingModule } from '@nestjs/testing';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { Tenant } from '../auth/auth.types';

describe('JobsController', () => {
  let controller: JobsController;
  let jobsService: {
    create: jest.Mock;
    claim: jest.Mock;
    ack: jest.Mock;
    fail: jest.Mock;
    findById: jest.Mock;
    findAll: jest.Mock;
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
    jobsService = {
      create: jest.fn(),
      claim: jest.fn(),
      ack: jest.fn(),
      fail: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        {
          provide: JobsService,
          useValue: jobsService,
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<JobsController>(JobsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a job for the tenant', async () => {
    const body = { idempotencyKey: 'abcde', payload: { hello: 'world' } };
    jobsService.create.mockResolvedValue({ id: 'job-1' });

    await expect(controller.create(tenant, body)).resolves.toEqual({
      id: 'job-1',
    });
    expect(jobsService.create).toHaveBeenCalledWith(tenant, body);
  });

  it('should claim a job for a worker', async () => {
    jobsService.claim.mockResolvedValue({ id: 'job-1' });

    await expect(controller.claim(tenant, 'worker-1')).resolves.toEqual({
      id: 'job-1',
    });
    expect(jobsService.claim).toHaveBeenCalledWith(tenant, 'worker-1');
  });

  it('should ack a job for a worker', async () => {
    jobsService.ack.mockResolvedValue({ id: 'job-1', status: 'SUCCESS' });

    await expect(controller.ack(tenant, 'job-1', 'worker-1')).resolves.toEqual({
      id: 'job-1',
      status: 'SUCCESS',
    });
    expect(jobsService.ack).toHaveBeenCalledWith(tenant, 'job-1', 'worker-1');
  });

  it('should fail a job for a worker', async () => {
    jobsService.fail.mockResolvedValue({ id: 'job-1', status: 'PENDING' });

    await expect(
      controller.fail(tenant, 'job-1', 'worker-1', 'boom'),
    ).resolves.toEqual({
      id: 'job-1',
      status: 'PENDING',
    });
    expect(jobsService.fail).toHaveBeenCalledWith(
      tenant,
      'job-1',
      'worker-1',
      'boom',
    );
  });

  it('should find a job by id', async () => {
    jobsService.findById.mockResolvedValue({ id: 'job-1' });

    await expect(controller.find(tenant, 'job-1')).resolves.toEqual({
      id: 'job-1',
    });
    expect(jobsService.findById).toHaveBeenCalledWith(tenant, 'job-1');
  });

  it('should list jobs for a tenant', async () => {
    jobsService.findAll.mockResolvedValue([{ id: 'job-1' }]);

    await expect(controller.findAll(tenant, 'PENDING')).resolves.toEqual([
      { id: 'job-1' },
    ]);
    expect(jobsService.findAll).toHaveBeenCalledWith(tenant, 'PENDING');
  });
});
