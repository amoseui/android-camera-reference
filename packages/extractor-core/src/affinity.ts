import type { SourceId } from '@acref/schema';

export const FIELD_AFFINITY: Record<string, SourceId[]> = {
  'signature.parameters': ['aosp-code', 'aidl'],
  'signature.returnType': ['aosp-code', 'aidl'],
  'signature.modifiers': ['aosp-code'],
  tracesToFramework: ['aosp-code'],
  tracesToHal: ['aosp-code'],
  methodOf: ['aosp-code'],
  ownerClass: ['aosp-code'],
  description: ['javadoc-html', 'developer-docs'],
  since: ['aosp-code', 'javadoc-html'],
  deprecatedSince: ['aosp-code', 'javadoc-html'],
  removedSince: ['aosp-code'],
  requiresPermission: ['aosp-code', 'javadoc-html'],
  replacedBy: ['aosp-code', 'javadoc-html', 'developer-docs'],
  tags: ['developer-docs', 'javadoc-html'],
};

export function isSourceAllowed(fieldPath: string, source: SourceId): boolean {
  const allowed = FIELD_AFFINITY[fieldPath];
  if (!allowed) return true;
  return allowed.includes(source);
}
