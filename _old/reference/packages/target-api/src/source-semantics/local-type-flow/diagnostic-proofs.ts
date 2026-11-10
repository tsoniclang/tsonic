import type { SourceInputBackingConstraint, SourceInputDiagnosticCoverage, SourceInputDiagnosticIdentity } from "../../host-input/call-input.js";

export function sourceProvenDiagnosticRoots(coverages: readonly SourceInputDiagnosticCoverage[],
  proven: readonly SourceInputBackingConstraint[],
  obsoleteAlternative?: (coverage: Extract<SourceInputDiagnosticCoverage, { readonly kind: "complete" }>) => boolean):
  readonly SourceInputDiagnosticIdentity[] {
  const records = new Map<SourceInputDiagnosticIdentity, SourceInputDiagnosticCoverage[]>();
  for (const coverage of coverages) {
    let values = records.get(coverage.root);
    if (values === undefined) { values = []; records.set(coverage.root, values); }
    values.push(coverage);
  }
  const covered = (coverage: SourceInputDiagnosticCoverage): boolean => {
    if (coverage.kind !== "complete" || coverage.obligations.length === 0) return false;
    if (obsoleteAlternative?.(coverage) === true) return true;
    return coverage.obligations.every(obligation => proven.some(constraint => constraint.diagnostic === obligation.diagnostic &&
      constraint.rootDiagnostic === coverage.root && constraint.application === obligation.application));
  };
  return Object.freeze([...records].filter(([, values]) => values.every(covered)).map(([root]) => root));
}
