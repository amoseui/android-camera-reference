import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { extractCommand } from './extract-cmd.js';

describe('extract-cmd', () => {
  it('unit: writes one file per node id (no collisions)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'acref-extract-test-'));
    try {
      const r = await extractCommand({ target: 35, out: dir });
      expect(r.nodeCount).toBe(5);
      const files = await readdir(r.outDir);
      expect(files.length).toBe(5);
      expect(new Set(files).size).toBe(5);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('unit: filename includes hash suffix for disambiguation', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'acref-extract-test-'));
    try {
      await extractCommand({ target: 35, out: dir });
      const files = await readdir(join(dir, '35'));
      // Each file should end with _<8 hex chars>.yaml
      for (const f of files) {
        expect(f).toMatch(/_[0-9a-f]{8}\.yaml$/);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
