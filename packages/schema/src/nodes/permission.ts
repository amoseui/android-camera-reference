import { z } from 'zod';
import { NodeBase } from './base.js';

export const PermissionNode = NodeBase.extend({
  kind: z.literal('Permission'),
  permName: z.string(),
});
export type PermissionNode = z.infer<typeof PermissionNode>;
