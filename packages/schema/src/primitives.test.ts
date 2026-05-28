import { describe, expect, it } from 'vitest';
import { ApiLevel, Family, SourceId } from './primitives.js';

describe('primitives', () => {
  describe('unit: ApiLevel', () => {
    it('accepts 21', () => expect(ApiLevel.parse(21)).toBe(21));
    it('rejects 0', () => expect(() => ApiLevel.parse(0)).toThrow());
    it('rejects non-integer', () => expect(() => ApiLevel.parse(21.5)).toThrow());
    it('rejects 100', () => expect(() => ApiLevel.parse(100)).toThrow());
  });

  describe('unit: Family', () => {
    it('accepts cameraX', () => expect(Family.parse('cameraX')).toBe('cameraX'));
    it('accepts camera1', () => expect(Family.parse('camera1')).toBe('camera1'));
    it('accepts camera2', () => expect(Family.parse('camera2')).toBe('camera2'));
    it('rejects camera3', () => expect(() => Family.parse('camera3')).toThrow());
  });

  describe('unit: SourceId', () => {
    it('accepts all 5 sources', () => {
      ['aosp-code', 'aidl', 'javadoc-html', 'developer-docs', 'behavior-changes'].forEach((s) =>
        expect(SourceId.parse(s)).toBe(s),
      );
    });
    it('rejects unknown', () => expect(() => SourceId.parse('reddit')).toThrow());
  });
});
