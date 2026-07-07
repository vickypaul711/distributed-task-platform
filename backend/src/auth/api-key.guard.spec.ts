import {
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { AuthService } from './auth.service';
import { Tenant } from './auth.types';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let authService: { validateApiKey: jest.Mock };

  const createContext = (headers: Record<string, unknown> = {}) => {
    const request = {
      headers,
      method: 'GET',
      path: '/jobs',
    };

    return {
      request,
      context: {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as ExecutionContext,
    };
  };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();

    authService = {
      validateApiKey: jest.fn(),
    };
    guard = new ApiKeyGuard(authService as unknown as AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should reject requests without an API key', async () => {
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authService.validateApiKey).not.toHaveBeenCalled();
  });

  it('should reject requests with an invalid API key', async () => {
    const { context } = createContext({ 'x-api-key': 'bad-key' });
    authService.validateApiKey.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authService.validateApiKey).toHaveBeenCalledWith('bad-key');
  });

  it('should attach the tenant for valid API keys', async () => {
    const tenant: Tenant = {
      id: 'tenant-1',
      name: 'Acme',
      rate_limit_per_minute: 10,
      max_concurrent_jobs: 2,
      default_max_attempts: 3,
      max_allowed_attempts: 5,
    };
    const { context, request } = createContext({ 'x-api-key': 'good-key' });
    authService.validateApiKey.mockResolvedValue(tenant);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request['tenant']).toEqual(tenant);
  });
});
