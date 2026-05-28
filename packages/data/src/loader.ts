import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface AcrefMeta {
  dataVersion: string;
  schemaVersion: string;
  targets: number[];
  builtAt: string;
  nodeCount: number;
}

export interface AcrefData {
  nodes: Record<string, Record<string, unknown>>;
  reverse: {
    byHal: Record<string, string[]>;
    byFrameworkSymbol: Record<string, string[]>;
    byTag: Record<string, string[]>;
    byPermission: Record<string, string[]>;
  };
  meta: AcrefMeta;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

export async function loadDataFromDist(distDir: string): Promise<AcrefData> {
  const index = await readJson<{ nodes: Record<string, Record<string, unknown>> }>(
    join(distDir, 'index.json'),
  );
  const reverse = {
    byHal: await readJson<Record<string, string[]>>(join(distDir, 'reverse', 'byHal.json')),
    byFrameworkSymbol: await readJson<Record<string, string[]>>(
      join(distDir, 'reverse', 'byFrameworkSymbol.json'),
    ),
    byTag: await readJson<Record<string, string[]>>(join(distDir, 'reverse', 'byTag.json')),
    byPermission: await readJson<Record<string, string[]>>(
      join(distDir, 'reverse', 'byPermission.json'),
    ),
  };
  const meta = await readJson<AcrefMeta>(join(distDir, 'meta.json'));
  return { nodes: index.nodes, reverse, meta };
}
