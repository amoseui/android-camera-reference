import { z, type ZodTypeAny } from 'zod';
import { VersionRangeKey } from './version-range.js';

export const Versioned = <T extends ZodTypeAny>(inner: T) =>
  z.union([inner, z.record(VersionRangeKey, inner)]);

export type Versioned<T> = T | Record<string, T>;
