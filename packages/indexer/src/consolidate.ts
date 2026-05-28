import { consolidatePerTarget } from '@acref/extractor-core';

export function consolidateNodes(
  perTarget: Record<number, Record<string, Record<string, unknown>>>,
): Record<string, Record<string, unknown>> {
  const allIds = new Set<string>();
  for (const target of Object.values(perTarget)) for (const id of Object.keys(target)) allIds.add(id);

  const result: Record<string, Record<string, unknown>> = {};

  for (const id of allIds) {
    const consolidated: Record<string, unknown> = {};
    const allFields = new Set<string>();
    for (const target of Object.values(perTarget)) {
      const node = target[id];
      if (node) for (const f of Object.keys(node)) allFields.add(f);
    }

    for (const field of allFields) {
      const perTargetForField: Record<number, unknown> = {};
      for (const [targetStr, target] of Object.entries(perTarget)) {
        const node = target[id];
        if (node && node[field] !== undefined) {
          perTargetForField[Number(targetStr)] = node[field];
        }
      }
      consolidated[field] = consolidatePerTarget(perTargetForField);
    }
    result[id] = consolidated;
  }
  return result;
}
