import { extractFixture } from '@acref/extractor-fixture';
import { writeYaml } from '@acref/extractor-core';
import { join } from 'node:path';

export interface ExtractInput {
  target: number;
  out: string;
}

export interface ExtractResult {
  target: number;
  outDir: string;
  nodeCount: number;
}

export async function extractCommand(input: ExtractInput): Promise<ExtractResult> {
  const { nodes } = extractFixture({ target: input.target });
  const outDir = join(input.out, String(input.target));
  for (const [id, node] of Object.entries(nodes)) {
    const safeName = id.replace(/[/:()$]/g, '_');
    await writeYaml(join(outDir, `${safeName}.yaml`), node);
  }
  return { target: input.target, outDir, nodeCount: Object.keys(nodes).length };
}
