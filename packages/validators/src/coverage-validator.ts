export interface CoverageInput {
  expectedNodeIds: string[];
  actualNodeIds: string[];
}

export interface CoverageWarning {
  missingId: string;
}

export interface CoverageResult {
  warnings: CoverageWarning[];
}

export function validateCoverage(input: CoverageInput): CoverageResult {
  const actual = new Set(input.actualNodeIds);
  return {
    warnings: input.expectedNodeIds
      .filter((id) => !actual.has(id))
      .map((missingId) => ({ missingId })),
  };
}
