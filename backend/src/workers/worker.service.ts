import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { withTimestamp } from '../common/logging/log-payload';
import { Tenant } from '../auth/auth.types';
import { JobsRepository } from '../jobs/jobs.repository';
import { JobsService } from '../jobs/jobs.service';
import { SimulateWorkersDto } from './worker.schema';

type ExecutablePayload = {
  simulateFailure?: boolean;
  fail?: boolean;
  durationMs?: number;
};

type SimulationRecord = {
  id: string;
  tenantId: string;
  startedAt: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  config: {
    jobCount: number;
    workerCount: number;
    failureRatePercent: number;
    maxAttempts: number;
    jobDurationMs: number;
    queueNames: string[];
    eventDelayMs: number;
  };
  progress: {
    seeded: number;
    claimed: number;
    acked: number;
    failed: number;
    requeued: number;
    dlq: number;
  };
  workerIds: string[];
  completedAt: string | null;
  error: string | null;
};

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private readonly eventDelayMs = 2000;
  private readonly simulations = new Map<string, SimulationRecord>();
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly workerId =
    process.env.WORKER_ID ?? `worker-${process.pid.toString()}`;

  constructor(
    private readonly jobsService: JobsService,
    private readonly jobsRepository: JobsRepository,
  ) {}

  onModuleInit() {
    if (process.env.WORKER_ENABLED !== 'true') {
      this.logger.log(
        withTimestamp({
          event: 'WORKER_LOOP_DISABLED',
        }),
      );

      return;
    }

    const intervalMs = this.getPositiveNumber(
      process.env.WORKER_POLL_INTERVAL_MS,
      1000,
    );

    this.timer = setInterval(() => {
      void this.processOnce();
    }, intervalMs);

    this.logger.log(
      withTimestamp({
        event: 'WORKER_LOOP_STARTED',
        workerId: this.workerId,
        intervalMs,
      }),
    );
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.logger.log(
      withTimestamp({
        event: 'WORKER_LOOP_STOPPED',
        workerId: this.workerId,
      }),
    );
  }

  async processOnce() {
    if (this.running) {
      return {
        claimed: 0,
        skipped: true,
      };
    }

    this.running = true;

    try {
      const tenants =
        (await this.jobsService.findRunnableTenants()) as Tenant[];
      let claimed = 0;

      for (const tenant of tenants) {
        const job = await this.jobsService.claim(tenant, this.workerId);

        if (!job) {
          continue;
        }

        claimed += 1;
        await this.executeClaimedJob(tenant, job);
      }

      return {
        claimed,
        skipped: false,
      };
    } finally {
      this.running = false;
    }
  }

  async processTenantOnce(tenant: Tenant) {
    const job = await this.jobsService.claim(tenant, this.workerId);

    if (!job) {
      return {
        claimed: 0,
        skipped: false,
      };
    }

    await this.executeClaimedJob(tenant, job);

    return {
      claimed: 1,
      skipped: false,
    };
  }

  async startSimulation(tenant: Tenant, options: SimulateWorkersDto) {
    if (options.maxAttempts > tenant.max_allowed_attempts) {
      throw new BadRequestException(
        `maxAttempts cannot exceed tenant limit of ${tenant.max_allowed_attempts}`,
      );
    }

    const queueNames = options.queueNames.length > 0 ? options.queueNames : ['default'];
    const simulationId = `${tenant.id}-${Date.now()}`;
    const workerIds = Array.from({ length: options.workerCount }, (_, index) => (
      `${this.workerId}-sim-${index + 1}`
    ));
    const record: SimulationRecord = {
      id: simulationId,
      tenantId: tenant.id,
      startedAt: new Date().toISOString(),
      status: 'RUNNING',
      config: {
        jobCount: options.jobCount,
        workerCount: options.workerCount,
        failureRatePercent: options.failureRatePercent,
        maxAttempts: options.maxAttempts,
        jobDurationMs: options.jobDurationMs,
        queueNames,
        eventDelayMs: this.eventDelayMs,
      },
      progress: {
        seeded: 0,
        claimed: 0,
        acked: 0,
        failed: 0,
        requeued: 0,
        dlq: 0,
      },
      workerIds,
      completedAt: null,
      error: null,
    };

    this.simulations.set(simulationId, record);

    record.progress.seeded = await this.jobsRepository.bulkCreateSimulationJobs(
      tenant.id,
      options.jobCount,
      queueNames,
      options.jobDurationMs,
      options.maxAttempts,
      simulationId,
    );

    this.logger.log(
      withTimestamp({
        event: 'WORKER_SIMULATION_STARTED',
        tenantId: tenant.id,
        simulationId,
        jobCount: options.jobCount,
        workerCount: options.workerCount,
        eventDelayMs: this.eventDelayMs,
      }),
    );

    void this.runSimulation(tenant, record);

    return {
      simulationId,
      tenantId: tenant.id,
      status: record.status,
      eventDelayMs: this.eventDelayMs,
      seededJobs: record.progress.seeded,
      workerIds,
      startedAt: record.startedAt,
    };
  }

  private async executeClaimedJob(
    tenant: Tenant,
    job: Record<string, unknown>,
  ) {
    try {
      const payload = job.payload as ExecutablePayload;
      const durationMs = this.getPositiveNumber(
        payload.durationMs?.toString(),
        0,
      );

      if (durationMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, durationMs));
      }

      if (payload.simulateFailure || payload.fail) {
        throw new Error('Simulated job failure');
      }

      await this.jobsService.ack(tenant, String(job.id), this.workerId);
    } catch (error: unknown) {
      await this.jobsService.fail(
        tenant,
        String(job.id),
        this.workerId,
        error instanceof Error ? error.message : 'Unknown worker error',
      );
    }
  }

  private async runSimulation(tenant: Tenant, record: SimulationRecord) {
    try {
      await Promise.all(
        record.workerIds.map((workerId) => this.runSimulationWorker(tenant, record, workerId)),
      );

      record.status = 'COMPLETED';
      record.completedAt = new Date().toISOString();

      this.logger.log(
        withTimestamp({
          event: 'WORKER_SIMULATION_COMPLETED',
          tenantId: tenant.id,
          simulationId: record.id,
          ...record.progress,
        }),
      );
    } catch (error: unknown) {
      record.status = 'FAILED';
      record.completedAt = new Date().toISOString();
      record.error =
        error instanceof Error ? error.message : 'Unknown simulation error';

      this.logger.error(
        withTimestamp({
          event: 'WORKER_SIMULATION_FAILED',
          tenantId: tenant.id,
          simulationId: record.id,
          message: record.error,
        }),
      );
    }
  }

  private async runSimulationWorker(
    tenant: Tenant,
    record: SimulationRecord,
    workerId: string,
  ) {
    while (true) {
      const job = await this.jobsService.claim(tenant, workerId);

      if (!job) {
        return;
      }

      record.progress.claimed += 1;

      await this.wait(this.eventDelayMs);

      const shouldFail = Math.random() * 100 < record.config.failureRatePercent;

      if (shouldFail) {
        const failedJob = await this.jobsService.fail(
          tenant,
          String(job.id),
          workerId,
          `Simulated failure from ${workerId}`,
        );

        record.progress.failed += 1;

        if (failedJob?.status === 'DLQ') {
          record.progress.dlq += 1;
        } else {
          record.progress.requeued += 1;
        }
      } else {
        await this.jobsService.ack(tenant, String(job.id), workerId);
        record.progress.acked += 1;
      }

      await this.wait(this.eventDelayMs);
    }
  }

  private wait(delayMs: number) {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  private getPositiveNumber(value: string | undefined, fallback: number) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0) {
      return fallback;
    }

    return Math.floor(parsed);
  }
}
