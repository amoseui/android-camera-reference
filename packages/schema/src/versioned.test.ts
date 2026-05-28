import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Versioned } from './versioned.js';

describe('versioned', () => {
  const VersionedString = Versioned(z.string());

  describe('unit: plain value', () => {
    it('accepts plain string', () => expect(VersionedString.parse('hello')).toBe('hello'));
  });

  describe('unit: range-keyed map', () => {
    it('accepts {"21..28": "v1", "29..": "v2"}', () => {
      const v = { '21..28': 'v1', '29..': 'v2' };
      expect(VersionedString.parse(v)).toEqual(v);
    });

    it('rejects invalid range key', () => {
      expect(() => VersionedString.parse({ abc: 'v1' })).toThrow();
    });
  });
});
