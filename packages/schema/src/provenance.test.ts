import { describe, expect, it } from 'vitest';
import { ProvenanceEntry } from './provenance.js';

describe('provenance', () => {
  describe('unit: ProvenanceEntry', () => {
    it('accepts minimal aosp-code entry', () => {
      const e = {
        source: 'aosp-code',
        repo: 'https://android.googlesource.com/platform/frameworks/base',
        ref: 'android-15.0.0_r1',
        path: 'core/java/android/hardware/Camera.java',
        lineRange: [100, 120],
        fetchedAt: '2026-05-29T00:17:00Z',
      };
      expect(ProvenanceEntry.parse(e)).toEqual(e);
    });

    it('accepts URL-only javadoc-html entry', () => {
      const e = {
        source: 'javadoc-html',
        url: 'https://developer.android.com/reference/foo',
        fetchedAt: '2026-05-29T00:17:00Z',
      };
      expect(ProvenanceEntry.parse(e)).toEqual(e);
    });

    it('rejects missing fetchedAt', () => {
      const e = { source: 'aosp-code', url: 'https://example.com' };
      expect(() => ProvenanceEntry.parse(e)).toThrow();
    });
  });
});
