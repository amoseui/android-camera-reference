import { z } from 'zod';
import { NodeBase } from './base.js';
import { Versioned } from '../versioned.js';

export const FrameworkSymbolNode = NodeBase.extend({
  kind: z.literal('FrameworkSymbol'),
  symbolKind: z.enum(['method', 'class', 'aidl']),
  fqName: z.string(),
  tracesToHal: Versioned(z.array(z.string())).optional(),
});
export type FrameworkSymbolNode = z.infer<typeof FrameworkSymbolNode>;
