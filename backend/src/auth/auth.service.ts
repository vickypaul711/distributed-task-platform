import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Tenant } from './auth.types';
import { VALIDATE_API_KEY_QUERY } from './auth.queries';

@Injectable()
export class AuthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async validateApiKey(apiKey: string): Promise<Tenant | null> {
    const result = await this.databaseService.query<Tenant>(
      VALIDATE_API_KEY_QUERY,
      [apiKey],
    );

    return result.rows[0] ?? null;
  }
}
