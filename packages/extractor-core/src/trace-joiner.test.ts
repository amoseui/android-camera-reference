import { describe, expect, it } from 'vitest';
import { joinTraces, DEFAULT_JOINER_OPTIONS } from './trace-joiner.js';

describe('trace-joiner (Phase 1 stub)', () => {
  it('unit: returns 0 additions on empty inputs', () => {
    expect(joinTraces([], []).tracesAdded).toBe(0);
  });

  it('unit: DEFAULT_JOINER_OPTIONS.maxDepth is 8', () => {
    expect(DEFAULT_JOINER_OPTIONS.maxDepth).toBe(8);
  });
});
