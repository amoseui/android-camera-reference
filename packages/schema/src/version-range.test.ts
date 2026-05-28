import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  VersionRangeKey,
  parseVersionRange,
  rangeContains,
  rangesOverlap,
} from './version-range.js';

describe('version-range', () => {
  describe('unit: VersionRangeKey regex', () => {
    it('accepts exact level "21"', () => expect(VersionRangeKey.parse('21')).toBe('21'));
    it('accepts closed range "21..28"', () =>
      expect(VersionRangeKey.parse('21..28')).toBe('21..28'));
    it('accepts open-upper "29.."', () => expect(VersionRangeKey.parse('29..')).toBe('29..'));
    it('accepts open-lower "..28"', () => expect(VersionRangeKey.parse('..28')).toBe('..28'));
    it('accepts wildcard ".."', () => expect(VersionRangeKey.parse('..')).toBe('..'));
    it('rejects invalid "abc"', () => expect(() => VersionRangeKey.parse('abc')).toThrow());
    it('rejects "21..28..30"', () => expect(() => VersionRangeKey.parse('21..28..30')).toThrow());
  });

  describe('unit: parseVersionRange', () => {
    it('parses "21..28" to {low:21, high:28}', () =>
      expect(parseVersionRange('21..28')).toEqual({ low: 21, high: 28 }));
    it('parses "29.." to {low:29}', () =>
      expect(parseVersionRange('29..')).toEqual({ low: 29 }));
    it('parses "..28" to {high:28}', () =>
      expect(parseVersionRange('..28')).toEqual({ high: 28 }));
    it('parses ".." to {}', () => expect(parseVersionRange('..')).toEqual({}));
    it('parses "21" to {low:21,high:21}', () =>
      expect(parseVersionRange('21')).toEqual({ low: 21, high: 21 }));
  });

  describe('unit: rangeContains', () => {
    it('"21..28" contains 25', () => expect(rangeContains('21..28', 25)).toBe(true));
    it('"21..28" contains 21', () => expect(rangeContains('21..28', 21)).toBe(true));
    it('"21..28" contains 28', () => expect(rangeContains('21..28', 28)).toBe(true));
    it('"21..28" does not contain 29', () => expect(rangeContains('21..28', 29)).toBe(false));
    it('"29.." contains 100', () => expect(rangeContains('29..', 100)).toBe(true));
    it('".." contains anything', () => expect(rangeContains('..', 50)).toBe(true));
  });

  describe('unit: rangesOverlap', () => {
    it('"21..28" overlaps "27..30"', () => expect(rangesOverlap('21..28', '27..30')).toBe(true));
    it('"21..28" does not overlap "29..30"', () =>
      expect(rangesOverlap('21..28', '29..30')).toBe(false));
    it('".." overlaps everything', () => expect(rangesOverlap('..', '21..28')).toBe(true));
    it('"29.." overlaps "30..40"', () => expect(rangesOverlap('29..', '30..40')).toBe(true));
  });

  describe('property: parse → format round-trips', () => {
    it('exact level round-trips', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 99 }), (n) => {
          const key = String(n);
          const parsed = parseVersionRange(key);
          expect(parsed.low).toBe(n);
          expect(parsed.high).toBe(n);
        }),
      );
    });

    it('closed range round-trips when low <= high', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 50, max: 99 }),
          (low, high) => {
            const key = `${low}..${high}`;
            const parsed = parseVersionRange(key);
            expect(parsed.low).toBe(low);
            expect(parsed.high).toBe(high);
          },
        ),
      );
    });
  });
});
