import { z } from 'zod';

export const VersionRangeKey = z
  .string()
  .regex(/^(\d+(\.\.\d+)?|\d+\.\.|\.\.\d+|\.\.)$/);
export type VersionRangeKey = z.infer<typeof VersionRangeKey>;

export interface ParsedRange {
  low?: number;
  high?: number;
}

export function parseVersionRange(key: string): ParsedRange {
  if (key === '..') return {};
  if (key.startsWith('..')) return { high: Number(key.slice(2)) };
  if (key.endsWith('..')) return { low: Number(key.slice(0, -2)) };
  if (key.includes('..')) {
    const [lo, hi] = key.split('..');
    return { low: Number(lo), high: Number(hi) };
  }
  const n = Number(key);
  return { low: n, high: n };
}

export function rangeContains(key: string, level: number): boolean {
  const { low, high } = parseVersionRange(key);
  if (low !== undefined && level < low) return false;
  if (high !== undefined && level > high) return false;
  return true;
}

export function rangesOverlap(a: string, b: string): boolean {
  const ra = parseVersionRange(a);
  const rb = parseVersionRange(b);
  const aLow = ra.low ?? -Infinity;
  const aHigh = ra.high ?? Infinity;
  const bLow = rb.low ?? -Infinity;
  const bHigh = rb.high ?? Infinity;
  return aLow <= bHigh && bLow <= aHigh;
}
