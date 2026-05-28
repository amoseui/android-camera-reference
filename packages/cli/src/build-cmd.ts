import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readYaml } from '@acref/extractor-core';
import { consolidateNodes, buildIndex } from '@acref/indexer';
import { SCHEMA_VERSION } from '@acref/schema';

export interface BuildInput {
  in: string;
  out: string;
  dataVersion: string;
}

async function walkYaml(
  d: string,
  nodesByTarget: Record<string, Record<string, unknown>>,
): Promise<void> {
  const entries = (await readdir(d, { withFileTypes: true })) as never as Array<{
    name: string;
    isDirectory(): boolean;
    isFile(): boolean;
  }>;
  for (const e of entries) {
    const full = join(d, e.name);
    if (e.isDirectory()) await walkYaml(full, nodesByTarget);
    else if (e.isFile() && e.name.endsWith('.yaml')) {
      const node = await readYaml<Record<string, unknown>>(full);
      nodesByTarget[node.id as string] = node;
    }
  }
}

async function loadGeneratedByTarget(
  dir: string,
): Promise<Record<number, Record<string, Record<string, unknown>>>> {
  const result: Record<number, Record<string, Record<string, unknown>>> = {};
  let targetDirs: { name: string; isDirectory: () => boolean }[] = [];
  try {
    targetDirs = (await readdir(dir, { withFileTypes: true })) as never;
  } catch {
    return result;
  }
  for (const ent of targetDirs) {
    if (!ent.isDirectory()) continue;
    const target = Number(ent.name);
    if (Number.isNaN(target)) continue;
    const targetPath = join(dir, ent.name);
    const nodesByTarget: Record<string, Record<string, unknown>> = {};
    await walkYaml(targetPath, nodesByTarget);
    result[target] = nodesByTarget;
  }
  return result;
}

export async function buildCommand(input: BuildInput): Promise<{ files: string[] }> {
  const perTarget = await loadGeneratedByTarget(input.in);
  const consolidated = consolidateNodes(perTarget);
  return buildIndex(consolidated, {
    outDir: input.out,
    schemaVersion: SCHEMA_VERSION,
    dataVersion: input.dataVersion,
    targets: Object.keys(perTarget).map(Number),
  });
}
