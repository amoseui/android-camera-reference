import type { AcrefData } from './loader.js';

export interface Migrations {
  replacedBy: string[];
  migratedFrom: string[];
}

export function migrationsOf(data: AcrefData, nodeId: string): Migrations {
  const node = data.nodes[nodeId];
  return {
    replacedBy: (node?.replacedBy as string[] | undefined) ?? [],
    migratedFrom: (node?.migratedFrom as string[] | undefined) ?? [],
  };
}
