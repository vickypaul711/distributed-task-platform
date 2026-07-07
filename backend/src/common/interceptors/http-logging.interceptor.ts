import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { catchError, tap, throwError } from 'rxjs';

import type { Tenant } from '../../auth/auth.types';
import { withTimestamp } from '../logging/log-payload';
import { requestContext } from '../../tracing/request-context';

type TenantRequest = Request & {
  tenant?: Tenant;
};

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<TenantRequest>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();
    const requestId =
      this.getHeaderValue(request.headers['x-request-id']) ?? randomUUID();

    response.setHeader('x-request-id', requestId);

    return requestContext.run({ requestId }, () =>
      next.handle().pipe(
        tap(() => {
          this.logger.log(
            withTimestamp({
              event: 'HTTP_REQUEST_COMPLETED',
              method: request.method,
              path: request.path,
              statusCode: response.statusCode,
              durationMs: Date.now() - startedAt,
              tenantId: request.tenant?.id,
              requestId,
            }),
          );
        }),
        catchError((error: unknown) => {
          const statusCode =
            error instanceof HttpException ? error.getStatus() : 500;

          this.logger.error(
            withTimestamp({
              event: 'HTTP_REQUEST_FAILED',
              method: request.method,
              path: request.path,
              statusCode,
              durationMs: Date.now() - startedAt,
              tenantId: request.tenant?.id,
              requestId,
              message: error instanceof Error ? error.message : 'Unknown error',
            }),
            error instanceof Error ? error.stack : undefined,
          );

          return throwError(() => error);
        }),
      ),
    );
  }

  private getHeaderValue(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
      return value[0];
    }

    return value;
  }
}
