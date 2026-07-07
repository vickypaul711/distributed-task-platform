import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Subscription } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { withTimestamp } from '../common/logging/log-payload';
import { JobEventsService } from './job-events.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'jobs',
})
export class JobEventsGateway
  implements OnGatewayConnection, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(JobEventsGateway.name);
  private subscription: Subscription | null = null;

  constructor(
    private readonly authService: AuthService,
    private readonly jobEventsService: JobEventsService,
  ) {}

  onModuleInit() {
    this.subscription = this.jobEventsService.streamAll().subscribe((event) => {
      this.server
        .to(this.getTenantRoom(event.tenantId))
        .emit('job.status', event);
    });
  }

  onModuleDestroy() {
    this.subscription?.unsubscribe();
  }

  async handleConnection(client: Socket) {
    const apiKey = this.getApiKey(client);

    if (!apiKey) {
      this.reject(client, 'Missing API key');
      return;
    }

    const tenant = await this.authService.validateApiKey(apiKey);

    if (!tenant) {
      this.reject(client, 'Invalid API key');
      return;
    }

    client.data.tenantId = tenant.id;
    await client.join(this.getTenantRoom(tenant.id));

    client.emit('connected', {
      tenantId: tenant.id,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      withTimestamp({
        event: 'JOB_WEBSOCKET_CONNECTED',
        tenantId: tenant.id,
        socketId: client.id,
      }),
    );
  }

  @SubscribeMessage('ping')
  ping(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    body: unknown,
  ) {
    return {
      event: 'pong',
      timestamp: new Date().toISOString(),
      data: {
        tenantId: client.data.tenantId,
        body,
      },
    };
  }

  private getApiKey(client: Socket) {
    const authApiKey = client.handshake.auth?.apiKey;

    if (typeof authApiKey === 'string') {
      return authApiKey;
    }

    const headerApiKey = client.handshake.headers['x-api-key'];

    if (Array.isArray(headerApiKey)) {
      return headerApiKey[0];
    }

    return headerApiKey;
  }

  private reject(client: Socket, reason: string) {
    client.emit('error', {
      message: reason,
      timestamp: new Date().toISOString(),
    });
    client.disconnect(true);

    this.logger.warn(
      withTimestamp({
        event: 'JOB_WEBSOCKET_REJECTED',
        socketId: client.id,
        reason,
      }),
    );
  }

  private getTenantRoom(tenantId: string) {
    return `tenant:${tenantId}`;
  }
}
