const REF_FIELDS = [
  'methods',
  'tracesToFramework',
  'tracesToHal',
  'replacedBy',
  'migratedFrom',
  'requiresPermission',
  'parameterType',
  'returnsType',
  'relatedTo',
  'ownerClass',
  'extends',
  'implements',
];

export interface BrokenRef {
  fromNode: string;
  fieldPath: string;
  missingId: string;
}

export interface XrefResult {
  broken: BrokenRef[];
}

export function validateXref(nodes: Record<string, Record<string, unknown>>): XrefResult {
  const ids = new Set(Object.keys(nodes));
  const broken: BrokenRef[] = [];

  for (const [fromId, node] of Object.entries(nodes)) {
    for (const field of REF_FIELDS) {
      const value = node[field];
      if (value === undefined) continue;
      collectRefs(value, [], (ref, path) => {
        if (!ids.has(ref)) {
          broken.push({ fromNode: fromId, fieldPath: `${field}${path}`, missingId: ref });
        }
      });
    }
  }
  return { broken };
}

function collectRefs(value: unknown, path: string[], emit: (ref: string, path: string) => void) {
  if (typeof value === 'string') {
    emit(value, path.map((p) => `.${p}`).join(''));
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => collectRefs(v, [...path, String(i)], emit));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      collectRefs(v, [...path, k], emit);
    }
  }
}
