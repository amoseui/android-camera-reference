import { describe, expect, it } from 'vitest';
import { validateSchema } from './schema-validator.js';

const VALID = {
  id: 'permission/android.permission.CAMERA',
  kind: 'Permission',
  displayName: 'CAMERA',
  permName: 'android.permission.CAMERA',
  provenance: [{ source: 'aosp-code', ref: 'r1', fetchedAt: '2026-05-29T00:00:00Z' }],
};

describe('schema-validator', () => {
  it('unit: passes valid nodes', () => {
    const result = validateSchema({ [VALID.id]: VALID });
    expect(result.errors).toEqual([]);
  });

  it('unit: reports schema error on missing required field', () => {
    const bad = { ...VALID, provenance: [] };
    const result = validateSchema({ [bad.id]: bad });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.nodeId).toBe(bad.id);
  });
});
