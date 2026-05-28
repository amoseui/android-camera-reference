import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { extractCommand } from './extract-cmd.js';
import { validateCommand } from './validate-cmd.js';
import { buildCommand } from './build-cmd.js';
import { loadDataFromDist, tracesToHalOf } from '@acref/data';

describe('integration: full pipeline on fixture', () => {
  it('integration: extract → validate → build → import @acref/data works', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'acref-e2e-'));
    try {
      const generatedDir = join(workDir, 'generated');
      const distDir = join(workDir, 'dist');
      const valDir = join(workDir, 'val');

      // extract target 35
      const ex = await extractCommand({ target: 35, out: generatedDir });
      expect(ex.nodeCount).toBe(5);
      const files = await readdir(ex.outDir);
      expect(files.length).toBe(5);

      // validate
      const v = await validateCommand({ in: generatedDir, out: valDir, strict: true });
      expect(v.status).toBe('PASS');

      // build
      const b = await buildCommand({ in: generatedDir, out: distDir, dataVersion: '0.0.1' });
      expect(b.files.length).toBeGreaterThanOrEqual(6);

      // import data
      const data = await loadDataFromDist(distDir);
      expect(Object.keys(data.nodes).length).toBe(5);
      const halTraces = tracesToHalOf(
        data,
        'cameraX/androidx/camera/core/ImageCapture/takePicture(java.util.concurrent.Executor)',
        35,
      );
      expect(halTraces).toEqual(['hal/ICameraDeviceSession::processCaptureRequest_v3.7']);

      // meta sanity
      expect(data.meta.targets).toEqual([35]);
      expect(data.meta.nodeCount).toBe(5);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });
});
