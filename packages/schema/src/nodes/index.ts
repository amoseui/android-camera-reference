import { z } from 'zod';
import { ApiClassNode } from './api-class.js';
import { ApiMethodNode } from './api-method.js';
import { FrameworkSymbolNode } from './framework-symbol.js';
import { HalSymbolNode } from './hal-symbol.js';
import { PermissionNode } from './permission.js';

export {
  ApiClassNode,
  ApiMethodNode,
  FrameworkSymbolNode,
  HalSymbolNode,
  PermissionNode,
};

export const NodeUnion = z.discriminatedUnion('kind', [
  ApiClassNode,
  ApiMethodNode,
  FrameworkSymbolNode,
  HalSymbolNode,
  PermissionNode,
]);
export type NodeUnion = z.infer<typeof NodeUnion>;
