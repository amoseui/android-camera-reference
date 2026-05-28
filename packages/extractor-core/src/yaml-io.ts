import { parse, stringify } from 'yaml';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function writeYaml(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, stringify(data), 'utf8');
}

export async function readYaml<T>(filePath: string): Promise<T> {
  const text = await readFile(filePath, 'utf8');
  return parse(text) as T;
}
