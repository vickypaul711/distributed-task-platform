import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsRepository } from './tenants.repository';

describe('TenantsService', () => {
  let service: TenantsService;
  let tenantsRepository: {
    create: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
  };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();

    tenantsRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        {
          provide: TenantsRepository,
          useValue: tenantsRepository,
        },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create tenants with generated API keys', async () => {
    tenantsRepository.create.mockResolvedValue({
      id: 'tenant-1',
      plan_id: 'plan-1',
    });

    await expect(
      service.create({ name: 'Acme', planId: 'plan-1' }),
    ).resolves.toEqual({
      id: 'tenant-1',
      plan_id: 'plan-1',
    });
    expect(tenantsRepository.create).toHaveBeenCalledWith(
      { name: 'Acme', planId: 'plan-1' },
      expect.stringMatching(/^tq_/),
    );
  });

  it('should list tenants', async () => {
    tenantsRepository.findAll.mockResolvedValue([{ id: 'tenant-1' }]);

    await expect(service.findAll()).resolves.toEqual([{ id: 'tenant-1' }]);
  });

  it('should find a tenant by id', async () => {
    tenantsRepository.findById.mockResolvedValue({ id: 'tenant-1' });

    await expect(service.findById('tenant-1')).resolves.toEqual({
      id: 'tenant-1',
    });
  });
});
