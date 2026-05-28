import type { SourceId } from '@acref/schema';

export const GLOBAL_PRIORITY: SourceId[] = [
  'aosp-code',
  'aidl',
  'javadoc-html',
  'developer-docs',
  'behavior-changes',
];

const PRIORITY_INDEX = new Map<SourceId, number>(
  GLOBAL_PRIORITY.map((s, i) => [s, i]),
);

export function comparePriority(a: SourceId, b: SourceId): number {
  return (PRIORITY_INDEX.get(a) ?? 99) - (PRIORITY_INDEX.get(b) ?? 99);
}
