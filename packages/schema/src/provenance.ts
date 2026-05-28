import { z } from 'zod';
import { SourceId } from './primitives.js';

export const ProvenanceEntry = z.object({
  source: SourceId,
  repo: z.string().url().optional(),
  ref: z.string().optional(),
  path: z.string().optional(),
  lineRange: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).optional(),
  url: z.string().url().optional(),
  fetchedAt: z.string().datetime(),
});
export type ProvenanceEntry = z.infer<typeof ProvenanceEntry>;
