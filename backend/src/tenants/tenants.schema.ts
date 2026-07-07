import { z } from 'zod';

export const CreateTenantSchema = z.object({
  name: z.string().min(3),

  planId: z.uuid(),
});

export type CreateTenantDto = z.infer<typeof CreateTenantSchema>;
