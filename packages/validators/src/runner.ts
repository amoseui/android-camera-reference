import { validateSchema, type SchemaResult } from './schema-validator.js';
import { validateXref, type XrefResult } from './xref-validator.js';
import { validateCoverage, type CoverageResult } from './coverage-validator.js';
import { validateFreshness, type FreshnessResult } from './freshness-validator.js';

export interface RunOptions {
  strict?: boolean;
}

export interface RunInput {
  nodes: Record<string, Record<string, unknown>>;
  coverageExpected?: string[];
  currentRefByRepo?: Record<string, string>;
}

export interface RunSummary {
  schemaErrors: number;
  xrefBroken: number;
  coverageMissing: number;
  freshnessWarnings: number;
  status: 'PASS' | 'WARN' | 'FAIL';
}

export interface RunResult {
  summary: RunSummary;
  schema: SchemaResult;
  xref: XrefResult;
  coverage: CoverageResult;
  freshness: FreshnessResult;
}

export function runValidators(input: RunInput, options: RunOptions = {}): RunResult {
  const schema = validateSchema(input.nodes);
  const xref = validateXref(input.nodes);
  const coverage = validateCoverage({
    expectedNodeIds: input.coverageExpected ?? [],
    actualNodeIds: Object.keys(input.nodes),
  });
  const freshness = validateFreshness({
    nodes: input.nodes,
    currentRefByRepo: input.currentRefByRepo ?? {},
  });

  let status: RunSummary['status'] = 'PASS';
  const hasFailures = schema.errors.length > 0 || xref.broken.length > 0;
  const hasWarnings = coverage.warnings.length > 0 || freshness.warnings.length > 0;

  if (hasFailures) status = 'FAIL';
  else if (hasWarnings) status = options.strict ? 'FAIL' : 'WARN';

  return {
    summary: {
      schemaErrors: schema.errors.length,
      xrefBroken: xref.broken.length,
      coverageMissing: coverage.warnings.length,
      freshnessWarnings: freshness.warnings.length,
      status,
    },
    schema,
    xref,
    coverage,
    freshness,
  };
}
