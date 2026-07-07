import { Injectable, Logger } from '@nestjs/common';

import { withTimestamp } from '../common/logging/log-payload';
import { DlqRepository } from './dlq.repository';

@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);

  constructor(private readonly dlqRepository: DlqRepository) {}

  async findAll(tenantId: string) {
    const jobs = await this.dlqRepository.findAll(tenantId);

    this.logger.log(
      withTimestamp({
        event: 'DLQ_LISTED',
        tenantId,
        count: jobs.length,
      }),
    );

    return jobs;
  }
}
