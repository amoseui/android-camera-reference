import { describe, expect, it } from 'vitest';
import { mergeNodeStreams, type RawNodeStream } from './merger.js';

const PROV_AOSP = {
  source: 'aosp-code' as const,
  ref: 'r1',
  fetchedAt: '2026-05-29T00:00:00Z',
};
const PROV_JAVADOC = {
  source: 'javadoc-html' as const,
  url: 'https://x.example/y',
  fetchedAt: '2026-05-29T00:00:00Z',
};

describe('merger', () => {
  describe('unit: single stream emits node unchanged', () => {
    it('one source, single field', () => {
      const streams: RawNodeStream[] = [
        {
          source: 'aosp-code',
          provenance: PROV_AOSP,
          nodes: {
            'permission/android.permission.CAMERA': {
              id: 'permission/android.permission.CAMERA',
              kind: 'Permission',
              displayName: 'CAMERA',
              permName: 'android.permission.CAMERA',
            },
          },
        },
      ];
      const merged = mergeNodeStreams(streams);
      const node = merged['permission/android.permission.CAMERA']!;
      expect(node.kind).toBe('Permission');
      expect(node.provenance).toHaveLength(1);
      expect(node.provenance[0]!.source).toBe('aosp-code');
    });
  });

  describe('unit: two streams same field, priority wins, other → alternatives', () => {
    it('aosp-code wins, javadoc-html goes to alternatives', () => {
      const streams: RawNodeStream[] = [
        {
          source: 'aosp-code',
          provenance: PROV_AOSP,
          nodes: {
            'permission/android.permission.CAMERA': {
              id: 'permission/android.permission.CAMERA',
              kind: 'Permission',
              displayName: 'CAMERA (aosp)',
              permName: 'android.permission.CAMERA',
            },
          },
        },
        {
          source: 'javadoc-html',
          provenance: PROV_JAVADOC,
          nodes: {
            'permission/android.permission.CAMERA': {
              id: 'permission/android.permission.CAMERA',
              kind: 'Permission',
              displayName: 'CAMERA (javadoc)',
              permName: 'android.permission.CAMERA',
            },
          },
        },
      ];
      const merged = mergeNodeStreams(streams);
      const node = merged['permission/android.permission.CAMERA']!;
      expect(node.displayName).toBe('CAMERA (aosp)');
      expect(node.alternatives?.displayName).toHaveLength(1);
      expect(node.alternatives?.displayName?.[0]?.value).toBe('CAMERA (javadoc)');
      expect(node.provenance).toHaveLength(2);
    });
  });

  describe('unit: affinity filter drops disallowed source', () => {
    it('description from aosp-code is dropped (affinity = javadoc/developer-docs)', () => {
      const streams: RawNodeStream[] = [
        {
          source: 'aosp-code',
          provenance: PROV_AOSP,
          nodes: {
            'permission/x': {
              id: 'permission/x',
              kind: 'Permission',
              displayName: 'x',
              permName: 'x',
              description: 'from aosp',
            },
          },
        },
        {
          source: 'javadoc-html',
          provenance: PROV_JAVADOC,
          nodes: {
            'permission/x': {
              id: 'permission/x',
              kind: 'Permission',
              displayName: 'x',
              permName: 'x',
              description: 'from javadoc',
            },
          },
        },
      ];
      const merged = mergeNodeStreams(streams);
      const node = merged['permission/x']!;
      expect(node.description).toBe('from javadoc');
      expect(node.alternatives?.description).toBeUndefined();
    });
  });
});
