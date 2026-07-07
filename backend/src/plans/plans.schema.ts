import { z } from 'zod';

export const CreatePlanSchema = z
  .object({
    name: z.string().min(2).toUpperCase(),

    rateLimitPerMinute: z.number().int().positive(),

    maxConcurrentJobs: z.number().int().positive(),

    defaultMaxAttempts: z.number().int().positive(),

    maxAllowedAttempts: z.number().int().positive(),
  })
  .refine((plan) => plan.defaultMaxAttempts <= plan.maxAllowedAttempts, {
    message: 'defaultMaxAttempts cannot exceed maxAllowedAttempts',

    path: ['defaultMaxAttempts'],
  });

export type CreatePlanDto = z.infer<typeof CreatePlanSchema>;
