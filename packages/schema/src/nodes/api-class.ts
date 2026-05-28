import { z } from 'zod';
import { NodeBase } from './base.js';
import { Family } from '../primitives.js';

export const ApiClassNode = NodeBase.extend({
  kind: z.literal('ApiClass'),
  family: Family,
  packageName: z.string(),
  className: z.string(),
  classKind: z.enum(['class', 'interface', 'enum', 'abstract']),
  methods: z.array(z.string()),
  extends: z.string().optional(),
  implements: z.array(z.string()).optional(),
});
export type ApiClassNode = z.infer<typeof ApiClassNode>;
