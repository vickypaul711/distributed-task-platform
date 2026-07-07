import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: jest.Mocked<AppService>;

  beforeEach(async () => {
    appService = {
      getHello: jest.fn().mockReturnValue('Hello World!'),
      getHealth: jest.fn().mockResolvedValue({
        status: 'OK',
        database: 'CONNECTED',
        time: 123,
      }),
    } as unknown as jest.Mocked<AppService>;

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: appService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should return health details', async () => {
      await expect(appController.getHealth()).resolves.toEqual({
        status: 'OK',
        database: 'CONNECTED',
        time: 123,
      });

      expect(appService.getHealth).toHaveBeenCalledTimes(1);
    });
  });
});
