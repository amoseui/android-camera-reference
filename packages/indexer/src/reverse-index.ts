export interface ReverseIndex {
  byHal: Record<string, string[]>;
  byFrameworkSymbol: Record<string, string[]>;
  byTag: Record<string, string[]>;
  byPermission: Record<string, string[]>;
}

function pushUnique(map: Record<string, string[]>, key: string, value: string): void {
  const arr = map[key] ?? (map[key] = []);
  if (!arr.includes(value)) arr.push(value);
}

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectStrings(v, out);
  }
}

export function buildReverseIndex(
  nodes: Record<string, Record<string, unknown>>,
): ReverseIndex {
  const idx: ReverseIndex = {
    byHal: {},
    byFrameworkSymbol: {},
    byTag: {},
    byPermission: {},
  };

  for (const [id, node] of Object.entries(nodes)) {
    const halRefs: string[] = [];
    collectStrings(node.tracesToHal, halRefs);
    for (const h of halRefs) pushUnique(idx.byHal, h, id);

    const fwRefs: string[] = [];
    collectStrings(node.tracesToFramework, fwRefs);
    for (const f of fwRefs) pushUnique(idx.byFrameworkSymbol, f, id);

    const permRefs: string[] = [];
    collectStrings(node.requiresPermission, permRefs);
    for (const p of permRefs) pushUnique(idx.byPermission, p, id);

    const tags: string[] = [];
    collectStrings(node.tags, tags);
    for (const t of tags) pushUnique(idx.byTag, t, id);
  }
  return idx;
}
