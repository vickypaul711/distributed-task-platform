import { Test, TestingModule } from '@nestjs/testing';
import { DlqController } from './dlq.controller';
import { DlqService } from './dlq.service';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { Tenant } from '../auth/auth.types';

describe('DlqController', () => {
  let controller: DlqController;
  let dlqService: {
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
    dlqService = {
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DlqController],
      providers: [
        {
          provide: DlqService,
          useValue: dlqService,
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<DlqController>(DlqController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should list dead-letter jobs for the tenant', async () => {
    dlqService.findAll.mockResolvedValue([{ id: 'dlq-1' }]);

    await expect(controller.findAll(tenant)).resolves.toEqual([
      { id: 'dlq-1' },
    ]);
    expect(dlqService.findAll).toHaveBeenCalledWith(tenant.id);
  });
});
