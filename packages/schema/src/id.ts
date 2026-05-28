import type { Family } from './primitives.js';

export interface ApiClassIdInput {
  family: Family;
  classPath: string;
}

export interface ApiMethodIdInput extends ApiClassIdInput {
  methodName: string;
  canonicalParams: string[];
}

export interface FrameworkIdInput {
  classPath: string;
  methodName: string;
  canonicalParams: string[];
}

export interface HalIdInput {
  interfaceName: string;
  memberName: string;
  halVersion: string;
}

export interface PermissionIdInput {
  permName: string;
}

const TYPE_NORMALIZE: Record<string, string> = {
  'List<Surface>': 'java.util.List',
  'List<OutputConfiguration>': 'java.util.List',
};

export function canonicalizeParams(params: string[]): string[] {
  return params.map((p) => TYPE_NORMALIZE[p] ?? p.replace(/<.*>/g, ''));
}

export function composeApiClassId({ family, classPath }: ApiClassIdInput): string {
  return `${family}/${classPath}`;
}

export function composeApiMethodId(input: ApiMethodIdInput): string {
  const params = input.canonicalParams.join(',');
  return `${composeApiClassId(input)}/${input.methodName}(${params})`;
}

export function composeFrameworkId(input: FrameworkIdInput): string {
  return `framework/${input.classPath}#${input.methodName}(${input.canonicalParams.join(',')})`;
}

export function composeHalId(input: HalIdInput): string {
  return `hal/${input.interfaceName}::${input.memberName}_v${input.halVersion}`;
}

export function composePermissionId({ permName }: PermissionIdInput): string {
  return `permission/${permName}`;
}

const API_METHOD_RE = /^(camera1|camera2|cameraX)\/(.+)\/([^/(]+)\(([^)]*)\)$/;

export function parseApiMethodId(id: string): ApiMethodIdInput {
  const m = API_METHOD_RE.exec(id);
  if (!m) throw new Error(`Not a valid ApiMethod id: ${id}`);
  const [, family, classPath, methodName, paramsStr] = m;
  return {
    family: family as Family,
    classPath: classPath!,
    methodName: methodName!,
    canonicalParams: paramsStr ? paramsStr.split(',') : [],
  };
}

export function shortApiMethodId(
  input: { family: Family; simpleClassName: string; methodName: string },
  overloadIndex: number,
): string {
  return `${input.family}/${input.simpleClassName}#${input.methodName}~${overloadIndex}`;
}
