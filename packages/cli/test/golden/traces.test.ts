import { describe, expect, it } from 'vitest';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse } from 'yaml';
import { extractCommand } from '../../src/extract-cmd.js';
import { buildCommand } from '../../src/build-cmd.js';
import {
  loadDataFromDist,
  tracesToHalOf,
  tracesToFrameworkOf,
} from '@acref/data';

interface GoldenSpec {
  target: number;
  expectations: Array<{
    from: string;
    tracesToHal?: string[];
    tracesToFramework?: string[];
    requiresPermission?: string[];
  }>;
}

describe('golden: trace assertions on fixture', () => {
  it('golden: traces match expected map for target 35', async () => {
    const goldenPath = new URL('./traces.yaml', import.meta.url).pathname;
    const golden = parse(await readFile(goldenPath, 'utf8')) as GoldenSpec;

    const workDir = await mkdtemp(join(tmpdir(), 'acref-golden-'));
    try {
      const generatedDir = join(workDir, 'generated');
      const distDir = join(workDir, 'dist');
      await extractCommand({ target: golden.target, out: generatedDir });
      await buildCommand({ in: generatedDir, out: distDir, dataVersion: '0.0.1' });
      const data = await loadDataFromDist(distDir);

      for (const exp of golden.expectations) {
        if (exp.tracesToHal) {
          expect(tracesToHalOf(data, exp.from, golden.target)).toEqual(exp.tracesToHal);
        }
        if (exp.tracesToFramework) {
          expect(tracesToFrameworkOf(data, exp.from, golden.target)).toEqual(exp.tracesToFramework);
        }
        if (exp.requiresPermission) {
          const node = data.nodes[exp.from];
          expect((node as { requiresPermission?: string[] }).requiresPermission).toEqual(
            exp.requiresPermission,
          );
        }
      }
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });
});
