import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { DatabaseService } from '../database/database.service';
import { Tenant } from './auth.types';

describe('AuthService', () => {
  let service: AuthService;
  let databaseService: { query: jest.Mock };

  beforeEach(async () => {
    databaseService = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DatabaseService,
          useValue: databaseService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return tenant details for a valid API key', async () => {
    const tenant: Tenant = {
      id: 'tenant-1',
      name: 'Acme',
      rate_limit_per_minute: 10,
      max_concurrent_jobs: 2,
      default_max_attempts: 3,
      max_allowed_attempts: 5,
    };

    databaseService.query.mockResolvedValue({ rows: [tenant] });

    await expect(service.validateApiKey('secret')).resolves.toEqual(tenant);
    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE t.api_key=$1'),
      ['secret'],
    );
  });

  it('should return null when the API key is unknown', async () => {
    databaseService.query.mockResolvedValue({ rows: [] });

    await expect(service.validateApiKey('missing')).resolves.toBeNull();
  });
});
