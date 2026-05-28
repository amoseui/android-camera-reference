import type { AcrefData } from './loader.js';

export function getNode(data: AcrefData, id: string): Record<string, unknown> | undefined {
  return data.nodes[id];
}

export function getNodes(data: AcrefData, ids: string[]): Array<Record<string, unknown>> {
  return ids.map((id) => data.nodes[id]).filter((n): n is Record<string, unknown> => !!n);
}

export function findByShortId(data: AcrefData, shortId: string): Record<string, unknown> | undefined {
  for (const node of Object.values(data.nodes)) {
    if (node.shortId === shortId) return node;
  }
  return undefined;
}

export function findBySimpleName(data: AcrefData, simpleName: string): Array<Record<string, unknown>> {
  return Object.values(data.nodes).filter((n) => {
    const display = n.displayName;
    return typeof display === 'string' && display.startsWith(simpleName);
  });
}
