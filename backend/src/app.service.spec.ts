import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { DatabaseService } from './database/database.service';

describe('AppService', () => {
  let service: AppService;
  let databaseService: { query: jest.Mock };

  beforeEach(async () => {
    databaseService = {
      query: jest.fn().mockResolvedValue({
        rows: [{ time: 456 }],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: DatabaseService,
          useValue: databaseService,
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  it('should return the greeting', () => {
    expect(service.getHello()).toBe('Hello World!');
  });

  it('should query database health', async () => {
    await expect(service.getHealth()).resolves.toEqual({
      status: 'OK',
      database: 'CONNECTED',
      time: 456,
    });

    expect(databaseService.query).toHaveBeenCalledWith('SELECT NOW() as time');
  });
});
