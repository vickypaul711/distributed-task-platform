import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DlqService } from './dlq.service';
import { DlqRepository } from './dlq.repository';

describe('DlqService', () => {
  let service: DlqService;
  let dlqRepository: {
    findAll: jest.Mock;
  };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();

    dlqRepository = {
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DlqService,
        {
          provide: DlqRepository,
          useValue: dlqRepository,
        },
      ],
    }).compile();

    service = module.get<DlqService>(DlqService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should list dead-letter jobs for a tenant', async () => {
    dlqRepository.findAll.mockResolvedValue([{ id: 'dlq-1' }]);

    await expect(service.findAll('tenant-1')).resolves.toEqual([
      { id: 'dlq-1' },
    ]);
    expect(dlqRepository.findAll).toHaveBeenCalledWith('tenant-1');
  });
});
