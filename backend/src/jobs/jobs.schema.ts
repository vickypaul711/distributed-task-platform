import { z } from 'zod';

export const CreateJobSchema = z.object({
  idempotencyKey: z.string().min(5),

  payload: z.record(z.string(), z.unknown()),

  maxAttempts: z.number().int().positive().optional(),
});

export type CreateJobDto = z.infer<typeof CreateJobSchema>;
