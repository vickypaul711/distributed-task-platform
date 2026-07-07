import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database/database.service';
import { GET_HEALTH_QUERY } from './app.queries';

@Injectable()
export class AppService {
  constructor(private readonly databaseService: DatabaseService) {}
  getHello(): string {
    return 'Hello World!';
  }
  async getHealth(): Promise<{
    status: string;
    database: string;
    time: number;
  }> {
    const result = await this.databaseService.query(GET_HEALTH_QUERY);

    return {
      status: 'OK',
      database: 'CONNECTED',
      time: result.rows[0].time,
    };
  }
}
