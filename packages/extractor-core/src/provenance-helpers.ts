import type { ProvenanceEntry, SourceId } from '@acref/schema';

export function nowIso(): string {
  return new Date().toISOString();
}

export function provenance(
  partial: Omit<ProvenanceEntry, 'fetchedAt'> & { source: SourceId },
): ProvenanceEntry {
  return { ...partial, fetchedAt: nowIso() };
}
