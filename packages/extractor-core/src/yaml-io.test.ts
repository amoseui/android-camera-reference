import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeYaml, readYaml } from './yaml-io.js';

describe('yaml-io', () => {
  it('unit: round-trips a node-like object', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'acref-yaml-'));
    const file = join(dir, 'sub', 'node.yaml');
    const node = {
      id: 'permission/android.permission.CAMERA',
      kind: 'Permission',
      provenance: [{ source: 'aosp-code', fetchedAt: '2026-05-29T00:00:00Z' }],
    };
    try {
      await writeYaml(file, node);
      const back = await readYaml(file);
      expect(back).toEqual(node);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
