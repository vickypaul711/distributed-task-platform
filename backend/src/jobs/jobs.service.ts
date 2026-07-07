import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';

import { JobsRepository } from './jobs.repository';

import { CreateJobDto } from './jobs.schema';

import { Tenant } from '../auth/auth.types';
import { withTimestamp } from '../common/logging/log-payload';
import { JobEventsService } from '../realtime/job-events.service';

@Injectable()
export class JobsService {
  constructor(
    private readonly jobsRepository: JobsRepository,

    @Optional()
    private readonly jobEventsService?: JobEventsService,
  ) {}

  private readonly logger = new Logger(JobsService.name);

  async create(tenant: Tenant, data: CreateJobDto) {
    const maxAttempts = data.maxAttempts ?? tenant.default_max_attempts;

    if (maxAttempts > tenant.max_allowed_attempts) {
      this.logger.warn(
        withTimestamp({
          event: 'JOB_CREATE_MAX_ATTEMPTS_REJECTED',
          tenantId: tenant.id,
          requestedMaxAttempts: maxAttempts,
          maxAllowedAttempts: tenant.max_allowed_attempts,
        }),
      );

      throw new BadRequestException(
        'Max retry attempts exceeded for tenant plan',
      );
    }

    const result = await this.jobsRepository.create(
      tenant.id,
      {
        ...data,
        maxAttempts,
      },
      tenant.rate_limit_per_minute,
    );

    if (result.idempotencyConflict) {
      this.logger.warn(
        withTimestamp({
          event: 'JOB_CREATE_IDEMPOTENCY_CONFLICT',
          tenantId: tenant.id,
          idempotencyKey: data.idempotencyKey,
        }),
      );

      throw new ConflictException(
        'Idempotency key already exists with a different payload',
      );
    }

    if (result.rateLimited) {
      this.logger.warn(
        withTimestamp({
          event: 'JOB_CREATE_RATE_LIMITED',
          tenantId: tenant.id,
          recentJobs: result.recentJobs,
          rateLimitPerMinute: tenant.rate_limit_per_minute,
        }),
      );

      throw new HttpException(
        'Rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const job = result.job;

    if (!job) {
      throw new InternalServerErrorException('Job could not be created');
    }

    this.logger.log(
      withTimestamp({
        event: result.idempotencyReplay ? 'JOB_REPLAYED' : 'JOB_CREATED',
        tenantId: tenant.id,
        jobId: job.id,
      }),
    );

    this.jobEventsService?.emit({
      type: result.idempotencyReplay ? 'JOB_REPLAYED' : 'JOB_CREATED',
      tenantId: tenant.id,
      jobId: String(job.id),
      status: String(job.status),
    });

    return job;
  }

  async findById(tenant: Tenant, id: string) {
    const job = await this.jobsRepository.findById(tenant.id, id);

    if (!job) {
      this.logger.warn(
        withTimestamp({
          event: 'JOB_NOT_FOUND',
          tenantId: tenant.id,
          jobId: id,
        }),
      );
    }

    return job;
  }

  async findAll(tenant: Tenant, status?: string) {
    const jobs = await this.jobsRepository.findAll(tenant.id, status);

    this.logger.log(
      withTimestamp({
        event: 'JOBS_LISTED',
        tenantId: tenant.id,
        status,
        count: jobs.length,
      }),
    );

    return jobs;
  }

  async claim(tenant: Tenant, workerId: string) {
    this.assertWorkerId(workerId);

    const job = await this.jobsRepository.claim(
      tenant.id,
      workerId,
      tenant.max_concurrent_jobs,
    );

    if (job) {
      this.logger.log(
        withTimestamp({
          event: 'JOB_CLAIMED',
          tenantId: tenant.id,
          workerId,
          jobId: job.id,
        }),
      );

      this.jobEventsService?.emit({
        type: 'JOB_CLAIMED',
        tenantId: tenant.id,
        jobId: String(job.id),
        status: String(job.status),
        workerId,
      });
    } else {
      this.logger.debug(
        withTimestamp({
          event: 'JOB_CLAIM_SKIPPED',
          tenantId: tenant.id,
          workerId,
          maxConcurrentJobs: tenant.max_concurrent_jobs,
        }),
      );
    }

    return job;
  }

  async ack(tenant: Tenant, jobId: string, workerId: string) {
    this.assertWorkerId(workerId);

    const job = await this.jobsRepository.ack(tenant.id, jobId, workerId);

    if (job) {
      this.logger.log(
        withTimestamp({
          event: 'JOB_ACKED',
          tenantId: tenant.id,
          workerId,
          jobId,
        }),
      );

      this.jobEventsService?.emit({
        type: 'JOB_ACKED',
        tenantId: tenant.id,
        jobId,
        status: String(job.status),
        workerId,
      });
    } else {
      this.logger.warn(
        withTimestamp({
          event: 'JOB_ACK_REJECTED',
          tenantId: tenant.id,
          workerId,
          jobId,
        }),
      );
    }

    return job;
  }

  async fail(tenant: Tenant, jobId: string, workerId: string, reason: string) {
    this.assertWorkerId(workerId);

    const job = await this.jobsRepository.fail(
      tenant.id,
      jobId,
      workerId,
      reason,
    );

    if (job) {
      this.logger.warn(
        withTimestamp({
          event: job.status === 'DLQ' ? 'JOB_MOVED_TO_DLQ' : 'JOB_FAILED',

          tenantId: tenant.id,
          jobId,

          attemptCount: job.attempt_count,

          reason,
        }),
      );

      this.jobEventsService?.emit({
        type: job.status === 'DLQ' ? 'JOB_MOVED_TO_DLQ' : 'JOB_FAILED',
        tenantId: tenant.id,
        jobId,
        status: String(job.status),
        workerId,
        reason,
      });
    } else {
      this.logger.warn(
        withTimestamp({
          event: 'JOB_FAIL_REJECTED',
          tenantId: tenant.id,
          workerId,
          jobId,
          reason,
        }),
      );
    }

    return job;
  }

  async findRunnableTenants() {
    return this.jobsRepository.findRunnableTenants();
  }

  private assertWorkerId(workerId: string) {
    if (!workerId) {
      throw new BadRequestException('Missing x-worker-id header');
    }
  }
}
