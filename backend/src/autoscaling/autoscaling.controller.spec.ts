import { Test, TestingModule } from '@nestjs/testing';

import { ApiKeyGuard } from '../auth/api-key.guard';
import { Tenant } from '../auth/auth.types';
import { AutoscalingController } from './autoscaling.controller';
import { AutoscalingService } from './autoscaling.service';

describe('AutoscalingController', () => {
  let controller: AutoscalingController;
  let autoscalingService: {
    getRecommendation: jest.Mock;
  };

  const tenant: Tenant = {
    id: 'tenant-1',
    name: 'Acme',
    rate_limit_per_minute: 10,
    max_concurrent_jobs: 4,
    default_max_attempts: 3,
    max_allowed_attempts: 5,
  };

  beforeEach(async () => {
    autoscalingService = {
      getRecommendation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AutoscalingController],
      providers: [
        {
          provide: AutoscalingService,
          useValue: autoscalingService,
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<AutoscalingController>(AutoscalingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return the tenant autoscaling recommendation', async () => {
    const recommendation = {
      decision: 'SCALE_OUT',
      tenantId: tenant.id,
      desiredWorkerCount: 2,
    };
    autoscalingService.getRecommendation.mockResolvedValue(recommendation);

    await expect(controller.getRecommendation(tenant)).resolves.toEqual(
      recommendation,
    );
    expect(autoscalingService.getRecommendation).toHaveBeenCalledWith(tenant);
  });
});
