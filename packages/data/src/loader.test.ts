import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadDataFromDist } from './loader.js';

describe('loader', () => {
  it('unit: loads index.json + reverse/ + meta.json from a dist dir', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'acref-data-'));
    try {
      const nodes = { 'permission/x': { id: 'permission/x', kind: 'Permission' } };
      await writeFile(join(dir, 'index.json'), JSON.stringify({ nodes }));
      await mkdir(join(dir, 'reverse'), { recursive: true });
      await writeFile(join(dir, 'reverse', 'byHal.json'), JSON.stringify({}));
      await writeFile(join(dir, 'reverse', 'byFrameworkSymbol.json'), JSON.stringify({}));
      await writeFile(join(dir, 'reverse', 'byTag.json'), JSON.stringify({}));
      await writeFile(join(dir, 'reverse', 'byPermission.json'), JSON.stringify({}));
      await writeFile(
        join(dir, 'meta.json'),
        JSON.stringify({ dataVersion: '0.0.1', schemaVersion: '0.0.1', targets: [35], builtAt: 'x', nodeCount: 1 }),
      );

      const data = await loadDataFromDist(dir);
      expect(data.nodes['permission/x']!.id).toBe('permission/x');
      expect(data.meta.dataVersion).toBe('0.0.1');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
