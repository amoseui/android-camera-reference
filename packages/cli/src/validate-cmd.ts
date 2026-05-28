import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readYaml } from '@acref/extractor-core';
import { runValidators } from '@acref/validators';
import { writeFile, mkdir } from 'node:fs/promises';

export interface ValidateInput {
  in: string;
  out: string;
  strict: boolean;
}

export interface ValidateResult {
  status: 'PASS' | 'WARN' | 'FAIL';
  schemaErrors: number;
  xrefBroken: number;
}

async function loadAllYaml(dir: string): Promise<Record<string, Record<string, unknown>>> {
  const result: Record<string, Record<string, unknown>> = {};
  let entries: { name: string; isDirectory: () => boolean; isFile: () => boolean }[] = [];
  try {
    entries = (await readdir(dir, { withFileTypes: true })) as never;
  } catch {
    return result;
  }
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      Object.assign(result, await loadAllYaml(full));
    } else if (ent.isFile() && ent.name.endsWith('.yaml')) {
      const node = await readYaml<Record<string, unknown>>(full);
      const id = node.id as string;
      result[id] = node;
    }
  }
  return result;
}

export async function validateCommand(input: ValidateInput): Promise<ValidateResult> {
  const nodes = await loadAllYaml(input.in);
  const r = runValidators({ nodes }, { strict: input.strict });
  await mkdir(input.out, { recursive: true });
  await writeFile(join(input.out, 'summary.json'), JSON.stringify(r.summary, null, 2));
  await writeFile(join(input.out, 'schema-errors.json'), JSON.stringify(r.schema.errors, null, 2));
  await writeFile(join(input.out, 'xref-broken.json'), JSON.stringify(r.xref.broken, null, 2));
  return {
    status: r.summary.status,
    schemaErrors: r.summary.schemaErrors,
    xrefBroken: r.summary.xrefBroken,
  };
}
