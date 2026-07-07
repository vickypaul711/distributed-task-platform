import { Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { DatabaseService } from './database.service';

const mockQuery = jest.fn();
const mockEnd = jest.fn();
const mockOn = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery,
    end: mockEnd,
    on: mockOn,
  })),
}));

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.clearAllMocks();

    process.env.DATABASE_URL = 'postgres://test';
    service = new DatabaseService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.DATABASE_URL;
  });

  it('should create a pool with the configured connection string', () => {
    expect(Pool).toHaveBeenCalledWith({
      connectionString: 'postgres://test',
      max: 20,
      options: '-c timezone=UTC',
    });
    expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('should run queries through the pool', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 1 }] });

    await expect(service.query('SELECT 1', [])).resolves.toEqual({
      rows: [{ id: 1 }],
    });
    expect(mockQuery).toHaveBeenCalledWith('SELECT 1', []);
  });

  it('should log and rethrow failed queries', async () => {
    const error = new Error('database down');
    mockQuery.mockRejectedValue(error);

    await expect(service.query('SELECT 1')).rejects.toBe(error);
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'DATABASE_QUERY_FAILED',
        operation: 'SELECT',
        message: 'database down',
      }),
      error.stack,
    );
  });

  it('should log pool errors', () => {
    const poolErrorHandler = mockOn.mock.calls.find(
      ([eventName]) => eventName === 'error',
    )?.[1];

    poolErrorHandler(new Error('pool broke'));

    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'DATABASE_POOL_ERROR',
        message: 'pool broke',
      }),
      expect.any(String),
    );
  });

  it('should close the pool on module destroy', async () => {
    mockEnd.mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(mockEnd).toHaveBeenCalledTimes(1);
  });
});
