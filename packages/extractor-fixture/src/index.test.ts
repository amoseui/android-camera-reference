import { describe, expect, it } from 'vitest';
import { NodeUnion } from '@acref/schema';
import { extractFixture } from './fixture-nodes.js';

describe('extractor-fixture', () => {
  describe('unit: emits 5 valid nodes covering all kinds', () => {
    const result = extractFixture({ target: 35 });

    it('has exactly 5 nodes', () => {
      expect(Object.keys(result.nodes)).toHaveLength(5);
    });

    it('all nodes pass schema validation', () => {
      for (const [, node] of Object.entries(result.nodes)) {
        expect(() => NodeUnion.parse(node)).not.toThrow();
      }
    });

    it('covers all 5 node kinds', () => {
      const kinds = new Set(Object.values(result.nodes).map((n) => n.kind));
      expect(kinds).toEqual(new Set(['ApiClass', 'ApiMethod', 'FrameworkSymbol', 'HalSymbol', 'Permission']));
    });

    it('the ApiMethod has tracesToHal', () => {
      const apiMethod = Object.values(result.nodes).find((n) => n.kind === 'ApiMethod');
      expect(apiMethod).toBeDefined();
      expect((apiMethod as { tracesToHal?: unknown }).tracesToHal).toBeDefined();
    });
  });
});
