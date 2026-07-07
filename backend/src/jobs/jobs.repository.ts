import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
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
      `
        WITH recent_jobs AS (
          SELECT COUNT(*)::int AS count
          FROM jobs
          WHERE tenant_id=$1
          AND created_at >= NOW() - INTERVAL '1 minute'
        ),

        existing_job AS (
          SELECT *
          FROM jobs
          WHERE tenant_id=$1
          AND idempotency_key=$3
        ),

        inserted_job AS (
          INSERT INTO jobs
          (
            tenant_id,
            payload,
            idempotency_key,
            max_attempts
          )
          SELECT
            $1,
            $2,
            $3,
            $4
          WHERE
            (
              SELECT count
              FROM recent_jobs
            ) < $5
            AND NOT EXISTS (
              SELECT 1
              FROM existing_job
            )

          RETURNING *
        ),

        replayed_job AS (
          SELECT *
          FROM existing_job
          WHERE payload=$2::jsonb
        ),

        job_result AS (
          SELECT
            to_jsonb(inserted_job.*) AS job,
            FALSE AS idempotency_replay,
            FALSE AS idempotency_conflict,
            FALSE AS rate_limited,
            (
              SELECT count
              FROM recent_jobs
            ) AS recent_jobs

          FROM inserted_job

          UNION ALL

          SELECT
            to_jsonb(replayed_job.*) AS job,
            TRUE AS idempotency_replay,
            FALSE AS idempotency_conflict,
            FALSE AS rate_limited,
            (
              SELECT count
              FROM recent_jobs
            ) AS recent_jobs

          FROM replayed_job
        ),

        marker_result AS (
          SELECT
            NULL::jsonb AS job,
            FALSE AS idempotency_replay,
            TRUE AS idempotency_conflict,
            FALSE AS rate_limited,
            (
              SELECT count
              FROM recent_jobs
            ) AS recent_jobs
          WHERE EXISTS (
            SELECT 1
            FROM existing_job
          )
          AND NOT EXISTS (
            SELECT 1
            FROM replayed_job
          )

          UNION ALL

          SELECT
            NULL::jsonb AS job,
            FALSE AS idempotency_replay,
            FALSE AS idempotency_conflict,
            TRUE AS rate_limited,
            (
              SELECT count
              FROM recent_jobs
            ) AS recent_jobs
          WHERE (
            SELECT count
            FROM recent_jobs
          ) >= $5
          AND NOT EXISTS (
            SELECT 1
            FROM existing_job
          )
        )

        SELECT *
        FROM job_result

        UNION ALL

        SELECT *
        FROM marker_result

        LIMIT 1
        `,
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
      `
        WITH queue_config AS (
          SELECT
            $3::text[] AS names,
            $4::int AS duration_ms,
            $5::int AS max_attempts,
            $6::text AS batch_key
        ),
        inserted_jobs AS (
          INSERT INTO jobs
          (
            tenant_id,
            payload,
            idempotency_key,
            max_attempts
          )
          SELECT
            $1,
            jsonb_build_object(
              'type', 'simulation',
              'name', CONCAT('Simulation Job ', series_index.idx),
              'queue',
              (
                SELECT names[((series_index.idx - 1) % array_length(names, 1)) + 1]
                FROM queue_config
              ),
              'durationMs',
              (SELECT duration_ms FROM queue_config),
              'simulationBatch',
              (SELECT batch_key FROM queue_config),
              'simulationIndex', series_index.idx
            ),
            CONCAT((SELECT batch_key FROM queue_config), '-', series_index.idx),
            (SELECT max_attempts FROM queue_config)
          FROM generate_series(1, $2) AS series_index(idx)
          RETURNING id
        )
        SELECT COUNT(*)::int AS count
        FROM inserted_jobs
      `,
      [tenantId, jobCount, queueNames, durationMs, maxAttempts, batchKey],
    );

    return result.rows[0]?.count ?? 0;
  }

  async findById(tenantId: string, id: string) {
    const result = await this.databaseService.query(
      `
        SELECT *
        FROM jobs
        WHERE tenant_id=$1
        AND id=$2
        `,
      [tenantId, id],
    );

    return result.rows[0] ?? null;
  }

  async findAll(tenantId: string, status?: string) {
    const params: unknown[] = [tenantId];

    let query = `
    SELECT
      *

    FROM jobs

    WHERE tenant_id=$1
  `;

    if (status) {
      params.push(status);

      query += `
      AND status=$2::job_status
    `;
    }

    query += `
    ORDER BY created_at DESC
  `;

    const result = await this.databaseService.query(query, params);

    return result.rows;
  }

  async claim(tenantId: string, workerId: string, maxConcurrentJobs: number) {
    const result = await this.databaseService.query(
      `
    WITH running_count AS (

      SELECT COUNT(*)::int AS count

      FROM jobs

      WHERE tenant_id=$1

      AND status='RUNNING'

      AND lease_expires_at > NOW()

    ),


    selected_job AS (

      SELECT id

      FROM jobs

      WHERE

      tenant_id=$1

      AND

      (
        status='PENDING'

        OR

        (
          status='RUNNING'
          AND lease_expires_at < NOW()
        )

      )

      AND

      (
        SELECT count
        FROM running_count

      ) < $3


      ORDER BY created_at ASC


      FOR UPDATE SKIP LOCKED


      LIMIT 1

    ),


    updated_job AS (

      UPDATE jobs

      SET

        status='RUNNING',

        lease_owner=$2,

        lease_expires_at=NOW() + INTERVAL '30 seconds',

        started_at=COALESCE(started_at, NOW()),

        updated_at=NOW()


      WHERE id IN (

        SELECT id FROM selected_job

      )


      RETURNING *

    ),

    attempt_insert AS (

      INSERT INTO job_attempts
      (
        job_id,
        worker_id,
        attempt_number
      )

      SELECT
        id,
        $2,
        attempt_count + 1

      FROM updated_job

      RETURNING id
    )


    SELECT *

    FROM updated_job
    `,
      [tenantId, workerId, maxConcurrentJobs],
    );

    return result.rows[0] ?? null;
  }

  async ack(tenantId: string, jobId: string, workerId: string) {
    const result = await this.databaseService.query(
      `
      WITH updated_job AS (

        UPDATE jobs

        SET
          status='SUCCESS',
          lease_owner=NULL,
          lease_expires_at=NULL,
          completed_at=NOW(),
          updated_at=NOW()

        WHERE
          tenant_id=$1

          AND id=$2

          AND lease_owner=$3

          AND status='RUNNING'

        RETURNING *
      ),

      attempt_update AS (

        UPDATE job_attempts

        SET finished_at=NOW()

        WHERE job_id=$2
        AND worker_id=$3
        AND finished_at IS NULL

        RETURNING id
      )

      SELECT *
      FROM updated_job
      `,
      [tenantId, jobId, workerId],
    );

    return result.rows[0] ?? null;
  }

  async fail(
    tenantId: string,
    jobId: string,
    workerId: string,
    reason: string,
  ) {
    const result = await this.databaseService.query(
      `
      WITH updated_job AS (

        UPDATE jobs

        SET

          attempt_count = attempt_count + 1,


          status =
            CASE

              WHEN attempt_count + 1 >= max_attempts

              THEN 'DLQ'::job_status


              ELSE 'PENDING'::job_status

            END,


          lease_owner = NULL,


          lease_expires_at = NULL,


          last_error = $4,


          updated_at = NOW()


        WHERE

          tenant_id = $1

          AND id = $2

          AND lease_owner = $3

          AND status='RUNNING'


        RETURNING *

      ),


      attempt_update AS (

        UPDATE job_attempts

        SET
          error=$4,
          finished_at=NOW()

        WHERE job_id=$2
        AND worker_id=$3
        AND finished_at IS NULL

        RETURNING id

      ),


      dlq_insert AS (

        INSERT INTO dead_letter_jobs
        (
          job_id,
          tenant_id,
          payload,
          reason
        )


        SELECT

          id,
          tenant_id,
          payload,
          last_error


        FROM updated_job


        WHERE status='DLQ'

        AND NOT EXISTS (
          SELECT 1
          FROM dead_letter_jobs
          WHERE job_id=updated_job.id
        )


        RETURNING id

      )


      SELECT *

      FROM updated_job
      `,
      [tenantId, jobId, workerId, reason],
    );

    return result.rows[0] ?? null;
  }

  async countRecentJobs(tenantId: string) {
    const result = await this.databaseService.query(
      `
      SELECT

        COUNT(*)::int AS count

      FROM jobs


      WHERE tenant_id=$1


      AND created_at >= NOW() - INTERVAL '1 minute'
      `,
      [tenantId],
    );

    return result.rows[0].count;
  }

  async findRunnableTenants() {
    const result = await this.databaseService.query(
      `
        SELECT
          t.id,
          t.name,
          p.rate_limit_per_minute,
          p.max_concurrent_jobs,
          p.default_max_attempts,
          p.max_allowed_attempts

        FROM tenants t
        JOIN plans p
        ON p.id=t.plan_id

        WHERE EXISTS
        (
          SELECT 1
          FROM jobs j
          WHERE j.tenant_id=t.id
          AND (
            j.status='PENDING'
            OR (
              j.status='RUNNING'
              AND j.lease_expires_at < NOW()
            )
          )
        )
        `,
    );

    return result.rows;
  }

  async getQueueDepthByTenant() {
    const result = await this.databaseService.query(
      `
        SELECT
          tenant_id,
          COUNT(*)
          FILTER (
            WHERE status='PENDING'
          )::int AS pending,
          COUNT(*)
          FILTER (
            WHERE status='RUNNING'
            AND lease_expires_at > NOW()
          )::int AS running,
          COUNT(*)
          FILTER (
            WHERE status='RUNNING'
            AND lease_expires_at <= NOW()
          )::int AS expired_leases,
          COUNT(*)
          FILTER (
            WHERE status='DLQ'
          )::int AS dlq

        FROM jobs

        GROUP BY tenant_id
        `,
    );

    return result.rows;
  }
}
