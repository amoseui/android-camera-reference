export interface FreshnessWarning {
  nodeId: string;
  providedRef: string | undefined;
  currentRef: string | undefined;
  ageDays?: number;
}

export interface FreshnessInput {
  nodes: Record<string, Record<string, unknown>>;
  currentRefByRepo: Record<string, string>;
}

export interface FreshnessResult {
  warnings: FreshnessWarning[];
}

export function validateFreshness(input: FreshnessInput): FreshnessResult {
  const warnings: FreshnessWarning[] = [];
  for (const [nodeId, node] of Object.entries(input.nodes)) {
    const provs = node.provenance;
    if (!Array.isArray(provs)) continue;
    for (const prov of provs) {
      if (typeof prov !== 'object' || prov === null) continue;
      const p = prov as { repo?: string; ref?: string };
      if (!p.repo || !p.ref) continue;
      const current = input.currentRefByRepo[p.repo];
      if (current && current !== p.ref) {
        warnings.push({ nodeId, providedRef: p.ref, currentRef: current });
      }
    }
  }
  return { warnings };
}
