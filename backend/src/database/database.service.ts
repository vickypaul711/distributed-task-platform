import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { withTimestamp } from '../common/logging/log-payload';
import { getRequestId } from '../tracing/request-context';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool: Pool;
  private readonly logger = new Logger(DatabaseService.name);

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      options: '-c timezone=UTC',
    });

    this.pool.on('error', (error) => {
      this.logger.error(
        withTimestamp({
          event: 'DATABASE_POOL_ERROR',
          message: error.message,
        }),
        error.stack,
      );
    });

    this.logger.log(
      withTimestamp({
        event: 'DATABASE_POOL_CREATED',
        hasConnectionString: Boolean(process.env.DATABASE_URL),
        maxConnections: 20,
      }),
    );
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    try {
      return await this.pool.query<T>(sql, params);
    } catch (error: unknown) {
      this.logger.error(
        withTimestamp({
          event: 'DATABASE_QUERY_FAILED',
          operation: this.getQueryOperation(sql),
          parameterCount: params?.length ?? 0,
          requestId: getRequestId(),
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        error instanceof Error ? error.stack : undefined,
      );

      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.log(
      withTimestamp({
        event: 'DATABASE_POOL_CLOSING',
      }),
    );

    await this.pool.end();

    this.logger.log(
      withTimestamp({
        event: 'DATABASE_POOL_CLOSED',
      }),
    );
  }

  private getQueryOperation(sql: string) {
    return sql.trim().split(/\s+/)[0]?.toUpperCase() ?? 'UNKNOWN';
  }
}
