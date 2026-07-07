import { z } from 'zod';

export const SimulateWorkersSchema = z.object({
  jobCount: z.coerce.number().int().min(1).max(5000).default(1000),
  workerCount: z.coerce.number().int().min(1).max(100).default(5),
  failureRatePercent: z.coerce.number().min(0).max(100).default(20),
  maxAttempts: z.coerce.number().int().min(1).max(10).default(3),
  jobDurationMs: z.coerce.number().int().min(0).max(30000).default(0),
  queueNames: z.array(z.string().min(1)).min(1).max(10).default(['default']),
});

export type SimulateWorkersDto = z.infer<typeof SimulateWorkersSchema>;
