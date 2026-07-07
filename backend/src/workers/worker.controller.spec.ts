import { Test, TestingModule } from '@nestjs/testing';

import { ApiKeyGuard } from '../auth/api-key.guard';
import { Tenant } from '../auth/auth.types';
import { WorkerController } from './worker.controller';
import { WorkerService } from './worker.service';
import { SimulateWorkersDto } from './worker.schema';

describe('WorkerController', () => {
  let controller: WorkerController;
  let workerService: {
    processTenantOnce: jest.Mock;
    startSimulation: jest.Mock;
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
    workerService = {
      processTenantOnce: jest.fn(),
      startSimulation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkerController],
      providers: [
        {
          provide: WorkerService,
          useValue: workerService,
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<WorkerController>(WorkerController);
  });

  it('should run one worker pass', async () => {
    workerService.processTenantOnce.mockResolvedValue({
      claimed: 1,
      skipped: false,
    });

    await expect(controller.runOnce(tenant)).resolves.toEqual({
      claimed: 1,
      skipped: false,
    });
    expect(workerService.processTenantOnce).toHaveBeenCalledWith(tenant);
  });

  it('should start a simulation run', async () => {
    const body: SimulateWorkersDto = {
      jobCount: 1000,
      workerCount: 4,
      failureRatePercent: 20,
      maxAttempts: 3,
      jobDurationMs: 0,
      queueNames: ['default', 'billing'],
    };

    workerService.startSimulation.mockResolvedValue({
      simulationId: 'sim-1',
    });

    await expect(controller.simulate(tenant, body)).resolves.toEqual({
      simulationId: 'sim-1',
    });
    expect(workerService.startSimulation).toHaveBeenCalledWith(tenant, body);
  });
});
