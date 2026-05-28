import type { ProvenanceEntry } from '@acref/schema';

export interface FreshnessWarning {
  nodeId: string;
  providedRef: string | undefined;
  currentRef: string | undefined;
  ageDays?: number;
}

export interface FreshnessInput {
  nodes: Record<string, { provenance: ProvenanceEntry[] }>;
  currentRefByRepo: Record<string, string>;
}

export interface FreshnessResult {
  warnings: FreshnessWarning[];
}

export function validateFreshness(input: FreshnessInput): FreshnessResult {
  const warnings: FreshnessWarning[] = [];
  for (const [nodeId, node] of Object.entries(input.nodes)) {
    for (const prov of node.provenance) {
      if (!prov.repo || !prov.ref) continue;
      const current = input.currentRefByRepo[prov.repo];
      if (current && current !== prov.ref) {
        warnings.push({ nodeId, providedRef: prov.ref, currentRef: current });
      }
    }
  }
  return { warnings };
}
