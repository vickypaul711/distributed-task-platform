export type AutoscalingDecision = 'SCALE_OUT' | 'SCALE_IN' | 'HOLD';

export type AutoscalingStats = {
  pendingJobs: number;
  runningJobs: number;
  expiredLeases: number;
  activeWorkers: number;
  dlqJobs: number;
  oldestPendingJobAgeSeconds: number;
};

export type AutoscalingRecommendation = {
  decision: AutoscalingDecision;
  tenantId: string;
  desiredWorkerCount: number;
  currentWorkerCount: number;
  maxWorkerCount: number;
  minWorkerCount: number;
  targetJobsPerWorker: number;
  stats: AutoscalingStats;
  reasons: string[];
};
