import { describe, expect, it } from 'vitest';
import type { AcrefData } from './loader.js';
import { getNode, findByShortId } from './lookup.js';
import { resolveVersioned } from './version.js';
import { tracesToHalOf, reverseTraceFromHal } from './trace.js';
import { migrationsOf } from './migration.js';
import { createSearchIndex, search } from './search.js';

const DATA: AcrefData = {
  nodes: {
    'cameraX/X/m()': {
      id: 'cameraX/X/m()',
      kind: 'ApiMethod',
      displayName: 'X.m',
      shortId: 'cameraX/X#m~0',
      tracesToHal: { '..28': ['hal/A::a_v3.2'], '29..': ['hal/A::a_v3.4'] },
      replacedBy: [],
      migratedFrom: ['camera2/Y/n()'],
    },
  },
  reverse: {
    byHal: { 'hal/A::a_v3.4': ['cameraX/X/m()'] },
    byFrameworkSymbol: {},
    byTag: {},
    byPermission: {},
  },
  meta: { dataVersion: '0.0.1', schemaVersion: '0.0.1', targets: [33, 34, 35], builtAt: 'x', nodeCount: 1 },
};

describe('data helpers', () => {
  describe('unit: lookup', () => {
    it('getNode finds by id', () => expect(getNode(DATA, 'cameraX/X/m()')!.id).toBe('cameraX/X/m()'));
    it('findByShortId works', () =>
      expect(findByShortId(DATA, 'cameraX/X#m~0')!.id).toBe('cameraX/X/m()'));
  });

  describe('unit: resolveVersioned', () => {
    it('returns "..28" value for api level 25', () => {
      const r = resolveVersioned<string[]>(
        { '..28': ['hal/A::a_v3.2'], '29..': ['hal/A::a_v3.4'] },
        25,
      );
      expect(r).toEqual(['hal/A::a_v3.2']);
    });
    it('returns "29.." value for api level 30', () => {
      const r = resolveVersioned<string[]>(
        { '..28': ['hal/A::a_v3.2'], '29..': ['hal/A::a_v3.4'] },
        30,
      );
      expect(r).toEqual(['hal/A::a_v3.4']);
    });
  });

  describe('unit: trace helpers', () => {
    it('tracesToHalOf resolves by api level', () => {
      expect(tracesToHalOf(DATA, 'cameraX/X/m()', 34)).toEqual(['hal/A::a_v3.4']);
    });

    it('reverseTraceFromHal returns ApiMethod ids', () => {
      expect(reverseTraceFromHal(DATA, 'hal/A::a_v3.4')).toEqual(['cameraX/X/m()']);
    });
  });

  describe('unit: migrations', () => {
    it('migrationsOf returns both lists', () => {
      expect(migrationsOf(DATA, 'cameraX/X/m()')).toEqual({
        replacedBy: [],
        migratedFrom: ['camera2/Y/n()'],
      });
    });
  });

  describe('unit: search', () => {
    it('finds X.m by query "X"', () => {
      const idx = createSearchIndex(DATA);
      const hits = search(idx, 'X');
      expect(hits[0]?.id).toBe('cameraX/X/m()');
    });
  });
});
