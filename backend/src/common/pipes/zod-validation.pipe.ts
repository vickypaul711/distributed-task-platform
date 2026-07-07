import {
  ArgumentMetadata,
  BadRequestException,
  Logger,
  PipeTransform,
} from '@nestjs/common';

import { ZodType } from 'zod';

import { withTimestamp } from '../logging/log-payload';

export class ZodValidationPipe implements PipeTransform {
  private readonly logger = new Logger(ZodValidationPipe.name);

  constructor(private readonly schema: ZodType) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      this.logger.warn(
        withTimestamp({
          event: 'REQUEST_VALIDATION_FAILED',
          type: metadata.type,
          data: metadata.data,
          errors: result.error.flatten(),
        }),
      );

      throw new BadRequestException(result.error.flatten());
    }

    return result.data;
  }
}
