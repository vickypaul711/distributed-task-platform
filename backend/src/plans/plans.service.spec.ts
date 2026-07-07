import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseError } from 'pg';
import { PlansService } from './plans.service';
import { PlansRepository } from './plans.repository';

describe('PlansService', () => {
  let service: PlansService;
  let plansRepository: {
    create: jest.Mock;
    getAll: jest.Mock;
  };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    plansRepository = {
      create: jest.fn(),
      getAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        {
          provide: PlansRepository,
          useValue: plansRepository,
        },
      ],
    }).compile();

    service = module.get<PlansService>(PlansService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create plans', async () => {
    plansRepository.create.mockResolvedValue({ id: 'plan-1', name: 'FREE' });

    await expect(
      service.create({
        name: 'FREE',
        rateLimitPerMinute: 10,
        maxConcurrentJobs: 2,
        defaultMaxAttempts: 3,
        maxAllowedAttempts: 5,
      }),
    ).resolves.toEqual({ id: 'plan-1', name: 'FREE' });
  });

  it('should translate unique constraint errors to conflicts', async () => {
    const error = new DatabaseError('duplicate', 0, 'error');
    error.code = '23505';
    plansRepository.create.mockRejectedValue(error);

    await expect(
      service.create({
        name: 'FREE',
        rateLimitPerMinute: 10,
        maxConcurrentJobs: 2,
        defaultMaxAttempts: 3,
        maxAllowedAttempts: 5,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should list plans', async () => {
    plansRepository.getAll.mockResolvedValue([{ id: 'plan-1' }]);

    await expect(service.finaAll()).resolves.toEqual([{ id: 'plan-1' }]);
  });

  it('should translate list failures to not found', async () => {
    plansRepository.getAll.mockRejectedValue(new Error('database down'));

    await expect(service.finaAll()).rejects.toBeInstanceOf(NotFoundException);
  });
});
