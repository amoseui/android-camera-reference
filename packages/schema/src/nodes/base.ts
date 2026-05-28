import { z } from 'zod';
import { ApiLevel } from '../primitives.js';
import { ProvenanceEntry } from '../provenance.js';
import { Versioned } from '../versioned.js';

const Alternative = z.object({
  value: z.unknown(),
  provenance: ProvenanceEntry,
});

export const NodeBase = z.object({
  id: z.string().min(1),
  shortId: z.string().optional(),
  displayName: z.string(),
  since: ApiLevel.optional(),
  deprecatedSince: ApiLevel.optional(),
  removedSince: ApiLevel.optional(),
  description: Versioned(z.string()).optional(),
  provenance: z.array(ProvenanceEntry).min(1),
  alternatives: z.record(z.string(), z.array(Alternative)).optional(),
});
