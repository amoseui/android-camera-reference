import { describe, expect, it } from 'vitest';
import { runValidators } from './runner.js';

const VALID = {
  id: 'permission/android.permission.CAMERA',
  kind: 'Permission',
  displayName: 'CAMERA',
  permName: 'android.permission.CAMERA',
  provenance: [{ source: 'aosp-code', ref: 'r1', fetchedAt: '2026-05-29T00:00:00Z' }],
};

describe('runValidators', () => {
  it('unit: clean input → PASS', () => {
    const r = runValidators({ nodes: { [VALID.id]: VALID } });
    expect(r.summary.status).toBe('PASS');
  });

  it('unit: coverage miss → WARN in non-strict, FAIL in strict', () => {
    const r1 = runValidators({
      nodes: { [VALID.id]: VALID },
      coverageExpected: ['missing/x'],
    });
    expect(r1.summary.status).toBe('WARN');

    const r2 = runValidators(
      { nodes: { [VALID.id]: VALID }, coverageExpected: ['missing/x'] },
      { strict: true },
    );
    expect(r2.summary.status).toBe('FAIL');
  });

  it('unit: schema error → FAIL even in non-strict', () => {
    const bad = { ...VALID, provenance: [] };
    const r = runValidators({ nodes: { [bad.id]: bad } });
    expect(r.summary.status).toBe('FAIL');
  });
});
