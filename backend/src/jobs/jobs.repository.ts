import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  ACK_JOB_QUERY,
  BULK_CREATE_SIMULATION_JOBS_QUERY,
  CLAIM_JOB_QUERY,
  COUNT_RECENT_JOBS_QUERY,
  CREATE_JOB_QUERY,
  FAIL_JOB_QUERY,
  FIND_ALL_JOBS_BASE_QUERY,
  FIND_ALL_JOBS_ORDER_BY_QUERY,
  FIND_ALL_JOBS_STATUS_FILTER,
  FIND_JOB_BY_ID_QUERY,
  FIND_RUNNABLE_TENANTS_QUERY,
  GET_QUEUE_DEPTH_BY_TENANT_QUERY,
} from './jobs.queries';
import { CreateJobDto } from './jobs.schema';

type CreateJobResultRow = {
  job: Record<string, unknown> | null;
  idempotency_replay: boolean;
  idempotency_conflict: boolean;
  rate_limited: boolean;
  recent_jobs: number;
};

@Injectable()
export class JobsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(
    tenantId: string,
    data: CreateJobDto,
    rateLimitPerMinute: number,
  ) {
    const result = await this.databaseService.query<CreateJobResultRow>(
      CREATE_JOB_QUERY,
      [
        tenantId,
        data.payload,
        data.idempotencyKey,
        data.maxAttempts,
        rateLimitPerMinute,
      ],
    );

    const row = result.rows[0];

    return {
      job: row.job,
      idempotencyReplay: row.idempotency_replay,
      idempotencyConflict: row.idempotency_conflict,
      rateLimited: row.rate_limited,
      recentJobs: row.recent_jobs,
    };
  }

  async bulkCreateSimulationJobs(
    tenantId: string,
    jobCount: number,
    queueNames: string[],
    durationMs: number,
    maxAttempts: number,
    batchKey: string,
  ) {
    const result = await this.databaseService.query<{ count: number }>(
      BULK_CREATE_SIMULATION_JOBS_QUERY,
      [tenantId, jobCount, queueNames, durationMs, maxAttempts, batchKey],
    );

    return result.rows[0]?.count ?? 0;
  }

  async findById(tenantId: string, id: string) {
    const result = await this.databaseService.query(FIND_JOB_BY_ID_QUERY, [
      tenantId,
      id,
    ]);

    return result.rows[0] ?? null;
  }

  async findAll(tenantId: string, status?: string) {
    const params: unknown[] = [tenantId];

    let query = FIND_ALL_JOBS_BASE_QUERY;

    if (status) {
      params.push(status);

      query += FIND_ALL_JOBS_STATUS_FILTER;
    }

    query += FIND_ALL_JOBS_ORDER_BY_QUERY;

    const result = await this.databaseService.query(query, params);

    return result.rows;
  }

  async claim(tenantId: string, workerId: string, maxConcurrentJobs: number) {
    const result = await this.databaseService.query(CLAIM_JOB_QUERY, [
      tenantId,
      workerId,
      maxConcurrentJobs,
    ]);

    return result.rows[0] ?? null;
  }

  async ack(tenantId: string, jobId: string, workerId: string) {
    const result = await this.databaseService.query(ACK_JOB_QUERY, [
      tenantId,
      jobId,
      workerId,
    ]);

    return result.rows[0] ?? null;
  }

  async fail(
    tenantId: string,
    jobId: string,
    workerId: string,
    reason: string,
  ) {
    const result = await this.databaseService.query(FAIL_JOB_QUERY, [
      tenantId,
      jobId,
      workerId,
      reason,
    ]);

    return result.rows[0] ?? null;
  }

  async countRecentJobs(tenantId: string) {
    const result = await this.databaseService.query(COUNT_RECENT_JOBS_QUERY, [
      tenantId,
    ]);

    return result.rows[0].count;
  }

  async findRunnableTenants() {
    const result = await this.databaseService.query(FIND_RUNNABLE_TENANTS_QUERY);

    return result.rows;
  }

  async getQueueDepthByTenant() {
    const result = await this.databaseService.query(GET_QUEUE_DEPTH_BY_TENANT_QUERY);

    return result.rows;
  }
}
