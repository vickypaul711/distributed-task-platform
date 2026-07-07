import { Injectable, Logger } from '@nestjs/common';

import { Tenant } from '../auth/auth.types';
import { withTimestamp } from '../common/logging/log-payload';
import { AutoscalingRepository } from './autoscaling.repository';
import {
  AutoscalingDecision,
  AutoscalingRecommendation,
  AutoscalingStats,
} from './autoscaling.types';

@Injectable()
export class AutoscalingService {
  private readonly logger = new Logger(AutoscalingService.name);

  constructor(private readonly autoscalingRepository: AutoscalingRepository) {}

  async getRecommendation(tenant: Tenant): Promise<AutoscalingRecommendation> {
    const stats = await this.autoscalingRepository.getStats(tenant.id);
    const minWorkerCount = this.getPositiveNumber(
      process.env.AUTOSCALING_MIN_WORKERS,
      0,
    );
    const configuredMaxWorkers = this.getPositiveNumber(
      process.env.AUTOSCALING_MAX_WORKERS,
      tenant.max_concurrent_jobs,
    );
    const maxWorkerCount = Math.max(
      minWorkerCount,
      Math.min(configuredMaxWorkers, tenant.max_concurrent_jobs),
    );
    const targetJobsPerWorker = this.getPositiveNumber(
      process.env.AUTOSCALING_TARGET_JOBS_PER_WORKER,
      5,
    );

    const desiredWorkerCount = this.calculateDesiredWorkerCount(
      stats,
      minWorkerCount,
      maxWorkerCount,
      targetJobsPerWorker,
    );
    const decision = this.getDecision(
      desiredWorkerCount,
      stats.activeWorkers,
      stats.pendingJobs,
      stats.expiredLeases,
    );
    const recommendation = {
      decision,
      tenantId: tenant.id,
      desiredWorkerCount,
      currentWorkerCount: stats.activeWorkers,
      maxWorkerCount,
      minWorkerCount,
      targetJobsPerWorker,
      stats,
      reasons: this.getReasons(stats, desiredWorkerCount, maxWorkerCount),
    };

    this.logger.log(
      withTimestamp({
        event: 'AUTOSCALING_RECOMMENDATION_CREATED',
        tenantId: tenant.id,
        decision,
        desiredWorkerCount,
        currentWorkerCount: stats.activeWorkers,
        pendingJobs: stats.pendingJobs,
        expiredLeases: stats.expiredLeases,
      }),
    );

    return recommendation;
  }

  private calculateDesiredWorkerCount(
    stats: AutoscalingStats,
    minWorkerCount: number,
    maxWorkerCount: number,
    targetJobsPerWorker: number,
  ) {
    const backlog = stats.pendingJobs + stats.expiredLeases;

    if (backlog === 0) {
      return minWorkerCount;
    }

    const backlogWorkers = Math.ceil(backlog / targetJobsPerWorker);

    return Math.min(maxWorkerCount, Math.max(minWorkerCount, backlogWorkers));
  }

  private getDecision(
    desiredWorkerCount: number,
    currentWorkerCount: number,
    pendingJobs: number,
    expiredLeases: number,
  ): AutoscalingDecision {
    if (desiredWorkerCount > currentWorkerCount) {
      return 'SCALE_OUT';
    }

    if (
      desiredWorkerCount < currentWorkerCount &&
      pendingJobs === 0 &&
      expiredLeases === 0
    ) {
      return 'SCALE_IN';
    }

    return 'HOLD';
  }

  private getReasons(
    stats: AutoscalingStats,
    desiredWorkerCount: number,
    maxWorkerCount: number,
  ) {
    const reasons: string[] = [];

    if (stats.pendingJobs > 0) {
      reasons.push(`${stats.pendingJobs} pending jobs need capacity`);
    }

    if (stats.expiredLeases > 0) {
      reasons.push(`${stats.expiredLeases} expired leases can be reclaimed`);
    }

    if (desiredWorkerCount === maxWorkerCount && stats.pendingJobs > 0) {
      reasons.push('desired workers capped by tenant or autoscaling limit');
    }

    if (stats.pendingJobs === 0 && stats.expiredLeases === 0) {
      reasons.push('no pending jobs or expired leases');
    }

    if (stats.dlqJobs > 0) {
      reasons.push(`${stats.dlqJobs} jobs are in DLQ`);
    }

    return reasons;
  }

  private getPositiveNumber(value: string | undefined, fallback: number) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0) {
      return fallback;
    }

    return Math.floor(parsed);
  }
}
