import { Test, TestingModule } from '@nestjs/testing';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

describe('TenantsController', () => {
  let controller: TenantsController;
  let tenantsService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
  };

  beforeEach(async () => {
    tenantsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        {
          provide: TenantsService,
          useValue: tenantsService,
        },
      ],
    }).compile();

    controller = module.get<TenantsController>(TenantsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create tenants', async () => {
    const body = { name: 'Acme', planId: 'plan-1' };
    tenantsService.create.mockResolvedValue({ id: 'tenant-1' });

    await expect(controller.create(body)).resolves.toEqual({ id: 'tenant-1' });
    expect(tenantsService.create).toHaveBeenCalledWith(body);
  });

  it('should list tenants', async () => {
    tenantsService.findAll.mockResolvedValue([{ id: 'tenant-1' }]);

    await expect(controller.findAll()).resolves.toEqual([{ id: 'tenant-1' }]);
  });

  it('should fetch one tenant', async () => {
    tenantsService.findById.mockResolvedValue({ id: 'tenant-1' });

    await expect(controller.findOne('tenant-1')).resolves.toEqual({
      id: 'tenant-1',
    });
  });
});
