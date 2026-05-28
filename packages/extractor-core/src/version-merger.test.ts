import { describe, expect, it } from 'vitest';
import { consolidatePerTarget } from './version-merger.js';

describe('version-merger', () => {
  describe('unit: same value across all targets becomes plain', () => {
    it('"void" everywhere', () => {
      const perTarget = { 33: 'void', 34: 'void', 35: 'void' };
      expect(consolidatePerTarget(perTarget)).toBe('void');
    });
  });

  describe('unit: different values become range-keyed', () => {
    it('changes at 34', () => {
      const perTarget = { 33: 'A', 34: 'B', 35: 'B' };
      expect(consolidatePerTarget(perTarget)).toEqual({ '33': 'A', '34..35': 'B' });
    });

    it('three distinct values', () => {
      const perTarget = { 33: 'A', 34: 'B', 35: 'C' };
      expect(consolidatePerTarget(perTarget)).toEqual({ '33': 'A', '34': 'B', '35': 'C' });
    });
  });

  describe('unit: array values consolidated by deep equality', () => {
    it('same array becomes plain', () => {
      const perTarget = { 33: ['x', 'y'], 34: ['x', 'y'] };
      expect(consolidatePerTarget(perTarget)).toEqual(['x', 'y']);
    });
  });

  describe('unit: single target value becomes plain', () => {
    it('only target 35', () => {
      const perTarget = { 35: 'lonely' };
      expect(consolidatePerTarget(perTarget)).toBe('lonely');
    });
  });
});
