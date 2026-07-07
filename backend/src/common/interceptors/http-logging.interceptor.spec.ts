import { ExecutionContext, HttpException, Logger } from '@nestjs/common';
import { of, throwError, lastValueFrom } from 'rxjs';
import { HttpLoggingInterceptor } from './http-logging.interceptor';

describe('HttpLoggingInterceptor', () => {
  let interceptor: HttpLoggingInterceptor;

  const createContext = (responseStatus = 200) =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          path: '/jobs',
          headers: {
            'x-request-id': 'request-1',
          },
          tenant: {
            id: 'tenant-1',
          },
        }),
        getResponse: () => ({
          statusCode: responseStatus,
          setHeader: jest.fn(),
        }),
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    interceptor = new HttpLoggingInterceptor();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log completed HTTP requests', async () => {
    const next = {
      handle: jest.fn().mockReturnValue(of({ ok: true })),
    };

    await expect(
      lastValueFrom(interceptor.intercept(createContext(), next)),
    ).resolves.toEqual({ ok: true });

    expect(Logger.prototype.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'HTTP_REQUEST_COMPLETED',
        method: 'GET',
        path: '/jobs',
        statusCode: 200,
        tenantId: 'tenant-1',
        requestId: 'request-1',
      }),
    );
  });

  it('should log failed HTTP requests', async () => {
    const error = new HttpException('Forbidden', 403);
    const next = {
      handle: jest.fn().mockReturnValue(throwError(() => error)),
    };

    await expect(
      lastValueFrom(interceptor.intercept(createContext(), next)),
    ).rejects.toBe(error);

    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'HTTP_REQUEST_FAILED',
        statusCode: 403,
        message: 'Forbidden',
      }),
      expect.any(String),
    );
  });
});
