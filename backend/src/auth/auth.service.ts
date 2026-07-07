import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Tenant } from './auth.types';

@Injectable()
export class AuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async validateApiKey(apiKey: string): Promise<Tenant | null> {
    const result = await this.databaseService.query<Tenant>(
      `SELECT
                    t.id,
                    t.name,
                    p.rate_limit_per_minute,
                    p.max_concurrent_jobs,
                    p.default_max_attempts,
                    p.max_allowed_attempts
                    FROM tenants t
                    JOIN plans p
                    ON p.id = t.plan_id
                    WHERE t.api_key=$1
                `,
      [apiKey],
    );

    return result.rows[0] ?? null;
  }
}
