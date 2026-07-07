import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { Tenant } from '../auth/auth.types';

describe('MetricsController', () => {
  let controller: MetricsController;
  let metricsService: {
    getMetrics: jest.Mock;
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
    metricsService = {
      getMetrics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        {
          provide: MetricsService,
          useValue: metricsService,
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<MetricsController>(MetricsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get tenant metrics', async () => {
    const metrics = {
      jobs: { total: 1 },
      dlq: { total: 0 },
    };
    metricsService.getMetrics.mockResolvedValue(metrics);

    await expect(controller.getMetrics(tenant)).resolves.toEqual(metrics);
    expect(metricsService.getMetrics).toHaveBeenCalledWith(tenant.id);
  });
});
