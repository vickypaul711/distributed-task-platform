import { Test, TestingModule } from '@nestjs/testing';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

describe('PlansController', () => {
  let controller: PlansController;
  let plansService: {
    create: jest.Mock;
    finaAll: jest.Mock;
  };

  beforeEach(async () => {
    plansService = {
      create: jest.fn(),
      finaAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlansController],
      providers: [
        {
          provide: PlansService,
          useValue: plansService,
        },
      ],
    }).compile();

    controller = module.get<PlansController>(PlansController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create plans', async () => {
    const body = {
      name: 'FREE',
      rateLimitPerMinute: 10,
      maxConcurrentJobs: 2,
      defaultMaxAttempts: 3,
      maxAllowedAttempts: 5,
    };
    plansService.create.mockResolvedValue({ id: 'plan-1', name: 'FREE' });

    await expect(controller.create(body)).resolves.toEqual({
      id: 'plan-1',
      name: 'FREE',
    });
    expect(plansService.create).toHaveBeenCalledWith(body);
  });

  it('should list plans', async () => {
    plansService.finaAll.mockResolvedValue([{ id: 'plan-1' }]);

    await expect(controller.findAll()).resolves.toEqual([{ id: 'plan-1' }]);
    expect(plansService.finaAll).toHaveBeenCalledTimes(1);
  });
});
