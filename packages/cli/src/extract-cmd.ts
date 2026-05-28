import { extractFixture } from '@acref/extractor-fixture';
import { writeYaml } from '@acref/extractor-core';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export interface ExtractInput {
  target: number;
  out: string;
}

export interface ExtractResult {
  target: number;
  outDir: string;
  nodeCount: number;
}

function safeFilename(id: string): string {
  const safeName = id.replace(/[\/:()$]/g, '_').slice(0, 80);
  const hash = createHash('sha1').update(id).digest('hex').slice(0, 8);
  return `${safeName}_${hash}.yaml`;
}

export async function extractCommand(input: ExtractInput): Promise<ExtractResult> {
  const { nodes } = extractFixture({ target: input.target });
  const outDir = join(input.out, String(input.target));
  for (const [id, node] of Object.entries(nodes)) {
    await writeYaml(join(outDir, safeFilename(id)), node);
  }
  return { target: input.target, outDir, nodeCount: Object.keys(nodes).length };
}
