import { parseVersionRange } from '@acref/schema';

export function resolveVersioned<T>(
  versioned: T | Record<string, T> | undefined,
  apiLevel: number,
): T | undefined {
  if (versioned === undefined) return undefined;
  if (typeof versioned !== 'object' || versioned === null || Array.isArray(versioned)) {
    return versioned as T;
  }
  const obj = versioned as Record<string, T>;
  for (const [key, value] of Object.entries(obj)) {
    const r = parseVersionRange(key);
    const low = r.low ?? -Infinity;
    const high = r.high ?? Infinity;
    if (apiLevel >= low && apiLevel <= high) return value;
  }
  return undefined;
}
