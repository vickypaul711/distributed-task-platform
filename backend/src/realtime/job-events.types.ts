export type JobEventType =
  | 'JOB_CREATED'
  | 'JOB_REPLAYED'
  | 'JOB_CLAIMED'
  | 'JOB_ACKED'
  | 'JOB_FAILED'
  | 'JOB_MOVED_TO_DLQ';

export type JobEvent = {
  type: JobEventType;
  tenantId: string;
  jobId: string;
  status: string;
  workerId?: string;
  reason?: string;
  occurredAt?: string;
  timestamp?: string;
};
