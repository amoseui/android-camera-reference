import { describe, expect, it } from 'vitest';
import { GLOBAL_PRIORITY, comparePriority } from './source-priority.js';
import { isSourceAllowed } from './affinity.js';

describe('source priority', () => {
  describe('unit: GLOBAL_PRIORITY order', () => {
    it('aosp-code is highest', () => expect(GLOBAL_PRIORITY[0]).toBe('aosp-code'));
    it('behavior-changes is lowest', () =>
      expect(GLOBAL_PRIORITY[GLOBAL_PRIORITY.length - 1]).toBe('behavior-changes'));
  });

  describe('unit: comparePriority', () => {
    it('aosp-code > developer-docs', () =>
      expect(comparePriority('aosp-code', 'developer-docs')).toBeLessThan(0));
    it('developer-docs < aosp-code', () =>
      expect(comparePriority('developer-docs', 'aosp-code')).toBeGreaterThan(0));
    it('same source = 0', () => expect(comparePriority('aidl', 'aidl')).toBe(0));
  });
});

describe('field affinity', () => {
  describe('unit: isSourceAllowed', () => {
    it('signature.parameters allows aosp-code', () =>
      expect(isSourceAllowed('signature.parameters', 'aosp-code')).toBe(true));
    it('signature.parameters rejects javadoc-html', () =>
      expect(isSourceAllowed('signature.parameters', 'javadoc-html')).toBe(false));
    it('description allows javadoc-html', () =>
      expect(isSourceAllowed('description', 'javadoc-html')).toBe(true));
    it('unknown field allows all sources (default)', () =>
      expect(isSourceAllowed('tags', 'developer-docs')).toBe(true));
  });
});
