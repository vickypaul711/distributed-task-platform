import { Injectable, Logger } from '@nestjs/common';

import { withTimestamp } from '../common/logging/log-payload';
import { MetricsRepository } from './metrics.repository';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(private readonly metricsRepository: MetricsRepository) {}

  async getMetrics(tenantId: string) {
    const metrics = await this.metricsRepository.getMetrics(tenantId);

    this.logger.log(
      withTimestamp({
        event: 'METRICS_READ',
        tenantId,
        jobsTotal: metrics.jobs.total,
        dlqTotal: metrics.dlq.total,
      }),
    );

    return metrics;
  }
}
