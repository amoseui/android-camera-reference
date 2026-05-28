import { z } from 'zod';

export const ApiLevel = z.number().int().min(1).max(99);
export type ApiLevel = z.infer<typeof ApiLevel>;

export const Family = z.enum(['camera1', 'camera2', 'cameraX']);
export type Family = z.infer<typeof Family>;

export const SourceId = z.enum([
  'aosp-code',
  'aidl',
  'javadoc-html',
  'developer-docs',
  'behavior-changes',
]);
export type SourceId = z.infer<typeof SourceId>;
