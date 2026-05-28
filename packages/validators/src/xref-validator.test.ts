import { describe, expect, it } from 'vitest';
import { validateXref } from './xref-validator.js';

describe('xref-validator', () => {
  it('unit: passes when all references resolve', () => {
    const nodes = {
      A: { id: 'A', kind: 'ApiMethod', tracesToHal: ['B'] },
      B: { id: 'B', kind: 'HalSymbol' },
    };
    expect(validateXref(nodes).broken).toEqual([]);
  });

  it('unit: reports broken reference', () => {
    const nodes = {
      A: { id: 'A', kind: 'ApiMethod', tracesToHal: ['B'] },
    };
    const r = validateXref(nodes);
    expect(r.broken).toHaveLength(1);
    expect(r.broken[0]!.missingId).toBe('B');
    expect(r.broken[0]!.fromNode).toBe('A');
  });

  it('unit: detects broken refs inside versioned map', () => {
    const nodes = {
      A: { id: 'A', kind: 'ApiMethod', tracesToHal: { '..': ['MISSING'] } },
    };
    const r = validateXref(nodes);
    expect(r.broken).toHaveLength(1);
    expect(r.broken[0]!.missingId).toBe('MISSING');
  });
});
