import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsRepository } from './metrics.repository';

describe('MetricsService', () => {
  let service: MetricsService;
  let metricsRepository: {
    getMetrics: jest.Mock;
  };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();

    metricsRepository = {
      getMetrics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: MetricsRepository,
          useValue: metricsRepository,
        },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get tenant metrics', async () => {
    const metrics = {
      jobs: { total: 4 },
      dlq: { total: 1 },
    };
    metricsRepository.getMetrics.mockResolvedValue(metrics);

    await expect(service.getMetrics('tenant-1')).resolves.toEqual(metrics);
    expect(metricsRepository.getMetrics).toHaveBeenCalledWith('tenant-1');
  });
});
