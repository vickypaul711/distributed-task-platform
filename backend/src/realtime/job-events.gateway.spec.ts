import { Logger } from '@nestjs/common';
import { Subject } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { JobEventsGateway } from './job-events.gateway';
import { JobEventsService } from './job-events.service';
import { JobEvent } from './job-events.types';

describe('JobEventsGateway', () => {
  let gateway: JobEventsGateway;
  let authService: {
    validateApiKey: jest.Mock;
  };
  let events: Subject<JobEvent>;
  let server: {
    to: jest.Mock;
  };
  let roomEmitter: {
    emit: jest.Mock;
  };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    events = new Subject<JobEvent>();
    authService = {
      validateApiKey: jest.fn(),
    };
    roomEmitter = {
      emit: jest.fn(),
    };
    server = {
      to: jest.fn().mockReturnValue(roomEmitter),
    };

    gateway = new JobEventsGateway(
      authService as unknown as AuthService,
      {
        streamAll: () => events.asObservable(),
      } as unknown as JobEventsService,
    );
    gateway['server'] = server as never;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should join authenticated clients to their tenant room', async () => {
    const client = createClient('good-key');
    authService.validateApiKey.mockResolvedValue({ id: 'tenant-1' });

    await gateway.handleConnection(client);

    expect(authService.validateApiKey).toHaveBeenCalledWith('good-key');
    expect(client.join).toHaveBeenCalledWith('tenant:tenant-1');
    expect(client.emit).toHaveBeenCalledWith(
      'connected',
      expect.objectContaining({
        tenantId: 'tenant-1',
        timestamp: expect.any(String),
      }),
    );
  });

  it('should reject unauthenticated clients', async () => {
    const client = createClient(undefined);

    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({
        message: 'Missing API key',
        timestamp: expect.any(String),
      }),
    );
  });

  it('should emit job events to tenant rooms', () => {
    gateway.onModuleInit();

    events.next({
      type: 'JOB_CREATED',
      tenantId: 'tenant-1',
      jobId: 'job-1',
      status: 'PENDING',
    });

    expect(server.to).toHaveBeenCalledWith('tenant:tenant-1');
    expect(roomEmitter.emit).toHaveBeenCalledWith(
      'job.status',
      expect.objectContaining({
        tenantId: 'tenant-1',
        jobId: 'job-1',
      }),
    );

    gateway.onModuleDestroy();
  });

  function createClient(apiKey: string | undefined) {
    return {
      id: 'socket-1',
      data: {},
      handshake: {
        auth: apiKey ? { apiKey } : {},
        headers: {},
      },
      join: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    } as never;
  }
});
