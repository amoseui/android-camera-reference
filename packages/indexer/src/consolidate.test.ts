import { describe, expect, it } from 'vitest';
import { consolidateNodes } from './consolidate.js';

describe('consolidate', () => {
  it('unit: same field across all targets becomes plain', () => {
    const perTarget = {
      33: { A: { id: 'A', kind: 'Permission', displayName: 'CAM', permName: 'p' } },
      34: { A: { id: 'A', kind: 'Permission', displayName: 'CAM', permName: 'p' } },
    };
    const consolidated = consolidateNodes(perTarget);
    expect(consolidated.A!.displayName).toBe('CAM');
  });

  it('unit: changing field becomes versioned map', () => {
    const perTarget = {
      33: { A: { id: 'A', kind: 'Permission', displayName: 'OLD', permName: 'p' } },
      34: { A: { id: 'A', kind: 'Permission', displayName: 'NEW', permName: 'p' } },
    };
    const c = consolidateNodes(perTarget);
    expect(c.A!.displayName).toEqual({ '33': 'OLD', '34': 'NEW' });
  });
});
