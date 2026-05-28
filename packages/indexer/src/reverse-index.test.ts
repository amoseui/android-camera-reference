import { describe, expect, it } from 'vitest';
import { buildReverseIndex } from './reverse-index.js';

describe('reverse-index', () => {
  it('unit: byHal maps HAL id to ApiMethod ids that trace to it', () => {
    const nodes = {
      'cameraX/Foo/bar()': {
        id: 'cameraX/Foo/bar()',
        kind: 'ApiMethod',
        tracesToHal: ['hal/X::y_v3.4'],
      },
      'hal/X::y_v3.4': { id: 'hal/X::y_v3.4', kind: 'HalSymbol' },
    };
    const idx = buildReverseIndex(nodes);
    expect(idx.byHal['hal/X::y_v3.4']).toEqual(['cameraX/Foo/bar()']);
  });

  it('unit: byPermission collects ApiMethods that require permission', () => {
    const nodes = {
      'cameraX/Foo/bar()': {
        id: 'cameraX/Foo/bar()',
        kind: 'ApiMethod',
        requiresPermission: ['permission/android.permission.CAMERA'],
      },
    };
    const idx = buildReverseIndex(nodes);
    expect(idx.byPermission['permission/android.permission.CAMERA']).toEqual(['cameraX/Foo/bar()']);
  });

  it('unit: byTag collects nodes by tag string', () => {
    const nodes = {
      'cameraX/Foo/bar()': { id: 'cameraX/Foo/bar()', kind: 'ApiMethod', tags: ['jpeg'] },
    };
    const idx = buildReverseIndex(nodes);
    expect(idx.byTag.jpeg).toEqual(['cameraX/Foo/bar()']);
  });
});
