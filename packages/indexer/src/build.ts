import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { buildReverseIndex } from './reverse-index.js';

export interface BuildOptions {
  outDir: string;
  schemaVersion: string;
  dataVersion: string;
  targets: number[];
}

export interface BuildResult {
  files: string[];
}

export async function buildIndex(
  nodes: Record<string, Record<string, unknown>>,
  options: BuildOptions,
): Promise<BuildResult> {
  await mkdir(join(options.outDir, 'reverse'), { recursive: true });

  const indexPath = join(options.outDir, 'index.json');
  await writeFile(indexPath, JSON.stringify({ nodes }, null, 2));

  const reverse = buildReverseIndex(nodes);
  const reverseFiles: string[] = [];
  for (const [name, data] of Object.entries(reverse)) {
    const p = join(options.outDir, 'reverse', `${name}.json`);
    await writeFile(p, JSON.stringify(data, null, 2));
    reverseFiles.push(p);
  }

  const meta = {
    dataVersion: options.dataVersion,
    schemaVersion: options.schemaVersion,
    targets: options.targets,
    builtAt: new Date().toISOString(),
    nodeCount: Object.keys(nodes).length,
  };
  const metaPath = join(options.outDir, 'meta.json');
  await writeFile(metaPath, JSON.stringify(meta, null, 2));

  return { files: [indexPath, ...reverseFiles, metaPath] };
}
