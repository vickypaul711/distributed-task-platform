import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

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
    const result = await this.databaseService.query('SELECT NOW() as time');

    return {
      status: 'OK',
      database: 'CONNECTED',
      time: result.rows[0].time,
    };
  }
}
