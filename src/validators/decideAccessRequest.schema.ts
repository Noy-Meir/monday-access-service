import { z } from 'zod';
import { RequestStatus } from '../models/AccessRequest';

export const decideAccessRequestSchema = z.object({
  decision: z.enum([RequestStatus.APPROVED, RequestStatus.DENIED], {
    required_error: 'decision is required',
    invalid_type_error: `decision must be one of: ${RequestStatus.APPROVED}, ${RequestStatus.DENIED}`,
  }),
  decisionNote: z
    .string()
    .max(500, 'decisionNote must be at most 500 characters')
    .trim()
    .optional(),
});

export type DecideAccessRequestInput = z.infer<typeof decideAccessRequestSchema>;
