import { z } from 'zod';
import { NodeBase } from './base.js';

export const HalSymbolNode = NodeBase.extend({
  kind: z.literal('HalSymbol'),
  symbolKind: z.enum(['method', 'interface', 'struct']),
  interface: z.string(),
  member: z.string(),
  halVersion: z.string().regex(/^\d+\.\d+$/),
});
export type HalSymbolNode = z.infer<typeof HalSymbolNode>;
