import { z } from 'zod';
import { NodeBase } from './base.js';
import { Family } from '../primitives.js';
import { Versioned } from '../versioned.js';

const SignatureShape = z.object({
  parameters: z.array(z.object({ name: z.string(), type: z.string() })),
  returnType: z.string(),
  modifiers: z.array(z.string()),
});

export const ApiMethodNode = NodeBase.extend({
  kind: z.literal('ApiMethod'),
  family: Family,
  ownerClass: z.string(),
  methodName: z.string(),
  canonicalParams: z.array(z.string()),
  returnType: z.string().optional(),
  signature: Versioned(SignatureShape),
  tracesToFramework: Versioned(z.array(z.string())).optional(),
  tracesToHal: Versioned(z.array(z.string())).optional(),
  replacedBy: z.array(z.string()).optional(),
  migratedFrom: z.array(z.string()).optional(),
  requiresPermission: z.array(z.string()).optional(),
  parameterType: z.array(z.string()).optional(),
  returnsType: z.string().optional(),
  relatedTo: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});
export type ApiMethodNode = z.infer<typeof ApiMethodNode>;
