import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from './index.js';

describe('schema package smoke', () => {
  it('unit: exports SCHEMA_VERSION constant', () => {
    expect(SCHEMA_VERSION).toBe('0.0.1');
  });
});
