type PerTarget<T> = Record<number, T>;

export function consolidatePerTarget<T>(perTarget: PerTarget<T>): T | Record<string, T> {
  const entries = Object.entries(perTarget)
    .map(([k, v]) => [Number(k), v] as [number, T])
    .sort((a, b) => a[0] - b[0]);

  if (entries.length === 0) return {} as Record<string, T>;
  if (entries.length === 1) return entries[0]![1];

  const groups: Array<{ low: number; high: number; value: T }> = [];
  for (const [level, value] of entries) {
    const last = groups[groups.length - 1];
    if (last && deepEqual(last.value, value) && last.high + 1 === level) {
      last.high = level;
    } else {
      groups.push({ low: level, high: level, value });
    }
  }

  if (groups.length === 1) return groups[0]!.value;

  const result: Record<string, T> = {};
  for (const g of groups) {
    const key = g.low === g.high ? String(g.low) : `${g.low}..${g.high}`;
    result[key] = g.value;
  }
  return result;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a as object);
    const bk = Object.keys(b as object);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}
