import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import { Request } from 'express';

import { withTimestamp } from '../common/logging/log-payload';
import { AuthService } from './auth.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const apiKey = request.headers['x-api-key'];

    if (!apiKey || Array.isArray(apiKey)) {
      this.logger.warn(
        withTimestamp({
          event: 'API_KEY_MISSING',
          method: request.method,
          path: request.path,
        }),
      );

      throw new UnauthorizedException('Missing API key');
    }

    const tenant = await this.authService.validateApiKey(apiKey);

    if (!tenant) {
      this.logger.warn(
        withTimestamp({
          event: 'API_KEY_INVALID',
          method: request.method,
          path: request.path,
        }),
      );

      throw new UnauthorizedException('Invalid API key');
    }

    // attach tenant for controllers
    request['tenant'] = tenant;

    this.logger.debug(
      withTimestamp({
        event: 'API_KEY_ACCEPTED',
        tenantId: tenant.id,
        method: request.method,
        path: request.path,
      }),
    );

    return true;
  }
}
