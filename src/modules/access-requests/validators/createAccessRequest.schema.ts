import { z } from 'zod';

export const createAccessRequestSchema = z.object({
  applicationName: z
    .string({ required_error: 'applicationName is required' })
    .min(2, 'applicationName must be at least 2 characters')
    .max(100, 'applicationName must be at most 100 characters')
    .trim(),
  justification: z
    .string({ required_error: 'justification is required' })
    .min(10, 'justification must be at least 10 characters')
    .max(1000, 'justification must be at most 1000 characters')
    .trim(),
});

export type CreateAccessRequestInput = z.infer<typeof createAccessRequestSchema>;
