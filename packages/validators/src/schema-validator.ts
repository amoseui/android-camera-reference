import { NodeUnion } from '@acref/schema';

export interface SchemaError {
  nodeId: string;
  path: string;
  message: string;
}

export interface SchemaResult {
  errors: SchemaError[];
  validNodeIds: string[];
}

export function validateSchema(nodes: Record<string, unknown>): SchemaResult {
  const errors: SchemaError[] = [];
  const validNodeIds: string[] = [];
  for (const [id, node] of Object.entries(nodes)) {
    const parsed = NodeUnion.safeParse(node);
    if (parsed.success) {
      validNodeIds.push(id);
    } else {
      for (const issue of parsed.error.issues) {
        errors.push({
          nodeId: id,
          path: issue.path.join('.'),
          message: issue.message,
        });
      }
    }
  }
  return { errors, validNodeIds };
}
