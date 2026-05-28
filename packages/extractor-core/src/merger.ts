import type { ProvenanceEntry, SourceId } from '@acref/schema';
import { comparePriority } from './source-priority.js';
import { isSourceAllowed } from './affinity.js';

export interface RawNodeStream {
  source: SourceId;
  provenance: ProvenanceEntry;
  nodes: Record<string, Record<string, unknown>>;
}

interface Alternative {
  value: unknown;
  provenance: ProvenanceEntry;
}

type Merged = Record<string, unknown> & {
  provenance: ProvenanceEntry[];
  alternatives?: Record<string, Alternative[]>;
};

const META_FIELDS = new Set(['id', 'kind', 'provenance', 'alternatives']);

export function mergeNodeStreams(streams: RawNodeStream[]): Record<string, Merged> {
  const allIds = new Set<string>();
  for (const s of streams) for (const id of Object.keys(s.nodes)) allIds.add(id);

  const result: Record<string, Merged> = {};

  for (const id of allIds) {
    const contributors = streams.filter((s) => s.nodes[id]);
    if (contributors.length === 0) continue;

    const node: Merged = { id, kind: '', provenance: [] };
    const allFields = new Set<string>();
    for (const c of contributors) for (const f of Object.keys(c.nodes[id]!)) allFields.add(f);

    for (const fieldPath of allFields) {
      if (META_FIELDS.has(fieldPath)) continue;

      const fieldContribs = contributors
        .filter((c) => c.nodes[id]![fieldPath] !== undefined)
        .filter((c) => isSourceAllowed(fieldPath, c.source));

      if (fieldContribs.length === 0) continue;

      const sorted = [...fieldContribs].sort((a, b) => comparePriority(a.source, b.source));
      const winner = sorted[0]!;
      node[fieldPath] = winner.nodes[id]![fieldPath];

      const losers = sorted.slice(1);
      if (losers.length > 0) {
        node.alternatives ??= {};
        node.alternatives[fieldPath] = losers.map((c) => ({
          value: c.nodes[id]![fieldPath],
          provenance: c.provenance,
        }));
      }
    }

    const sample = contributors[0]!.nodes[id]!;
    node.id = sample.id as string;
    node.kind = sample.kind as string;
    node.provenance = contributors.map((c) => c.provenance);

    result[id] = node;
  }

  return result;
}
