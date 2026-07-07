import { BadRequestException, Logger } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return parsed data when validation succeeds', () => {
    const pipe = new ZodValidationPipe(
      z.object({
        name: z.string().min(2),
      }),
    );

    expect(
      pipe.transform(
        { name: 'Acme' },
        { type: 'body', metatype: undefined, data: undefined },
      ),
    ).toEqual({ name: 'Acme' });
  });

  it('should throw BadRequestException when validation fails', () => {
    const pipe = new ZodValidationPipe(
      z.object({
        name: z.string().min(2),
      }),
    );

    expect(() =>
      pipe.transform(
        { name: 'A' },
        { type: 'body', metatype: undefined, data: undefined },
      ),
    ).toThrow(BadRequestException);
  });
});
