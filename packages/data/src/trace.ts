import type { AcrefData } from './loader.js';
import { resolveVersioned } from './version.js';

export function tracesToFrameworkOf(
  data: AcrefData,
  nodeId: string,
  apiLevel: number,
): string[] {
  const node = data.nodes[nodeId];
  if (!node) return [];
  return resolveVersioned(node.tracesToFramework as never, apiLevel) ?? [];
}

export function tracesToHalOf(data: AcrefData, nodeId: string, apiLevel: number): string[] {
  const node = data.nodes[nodeId];
  if (!node) return [];
  return resolveVersioned(node.tracesToHal as never, apiLevel) ?? [];
}

export function reverseTraceFromHal(data: AcrefData, halId: string): string[] {
  return data.reverse.byHal[halId] ?? [];
}
