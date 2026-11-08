import type { Node } from "@tsonic/tsts";
import type { SourceInputBackingConstraint, SourceInputCallCandidate, SourceInputCallSelection,
  SourceInputDiagnosticCoverage, SourceInputDiagnosticIdentity } from "../../host-input/call-input.js";
import type { SourceApplication } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../descriptor-contracts.js";
import type { SourceProducedApplication } from "./applications.js";
import { sourceSemanticRefusal } from "./semantic-production.js";

export type SourceCallCandidateEvaluation =
  | { readonly kind: "not-applicable"; readonly candidate: SourceInputCallCandidate; readonly site: Node; readonly message: string }
  | { readonly kind: "applicable"; readonly candidate: SourceInputCallCandidate; readonly application: SourceApplication;
      readonly proven: readonly SourceInputBackingConstraint[] };

export function selectSourceCallCandidate(selection: SourceInputCallSelection, invocation: Node,
  evaluate: (candidate: SourceInputCallCandidate) => SourceProductionResult<SourceCallCandidateEvaluation>): SourceProductionResult<SourceProducedApplication> {
  const refuse = (message: string) => sourceSemanticRefusal(invocation, message, "TSONIC_LOCAL_TYPE_GENERIC");
  if (selection.kind === "untyped") return refuse("This application has no original callable candidate to authenticate.");
  const candidates = selection.kind === "applicable" ? [selection.selection] : selection.candidates;
  let winner: Extract<SourceCallCandidateEvaluation, { readonly kind: "applicable" }> | undefined;
  if (selection.kind === "applicable") {
    const result = evaluate(selection.selection);
    if (result.kind !== "resolved") return result;
    if (result.value.kind === "not-applicable") return sourceSemanticRefusal(result.value.site, result.value.message, "TSONIC_LOCAL_TYPE_GENERIC");
    winner = result.value;
  } else {
    const order = selection.declarationOrder;
    if (order.kind !== "available" || order.signatures.length !== candidates.length ||
      new Set(order.signatures).size !== order.signatures.length ||
      candidates.some(candidate => !order.signatures.includes(candidate.application.signature)))
      return refuse("This conditional call has no complete original declaration-order candidate inventory.");
    for (const original of order.signatures) {
      const matching = candidates.filter(candidate => candidate.application.signature === original);
      if (matching.length !== 1) return refuse("An original declaration-order slot requires exactly one authentic candidate attempt.");
      const result = evaluate(matching[0]!);
      if (result.kind !== "resolved") return result;
      if (result.value.kind === "not-applicable") continue;
      winner = result.value;
      break;
    }
    if (winner === undefined) return refuse("No original declaration-order candidate is fully Source applicable.");
  }
  if (!candidates.includes(winner.candidate) || winner.candidate.application.invocation !== invocation ||
    winner.application.identity.invocation !== invocation) throw new Error("A Source winner requires its exact original invocation and candidate attempt.");
  const records = new Map<SourceInputDiagnosticIdentity, SourceInputDiagnosticCoverage[]>();
  for (const candidate of candidates) for (const coverage of [...candidate.diagnosticCoverage, ...candidate.constraints.map(constraint => constraint.rootCoverage)]) {
    let values = records.get(coverage.root);
    if (values === undefined) { values = []; records.set(coverage.root, values); }
    values.push(coverage);
  }
  const applications = new Set(candidates.map(candidate => candidate.application));
  const proven = winner.proven;
  const covered = (coverage: SourceInputDiagnosticCoverage): boolean => {
    if (coverage.kind !== "complete" || coverage.obligations.length === 0) return false;
    if (selection.kind === "conditional-candidates" && coverage.purpose.kind === "alternative-applicability" &&
      coverage.purpose.invocation === invocation) return coverage.obligations.every(obligation => obligation.kind === "applicability" &&
        obligation.application !== undefined && applications.has(obligation.application) && obligation.application.invocation === invocation);
    return coverage.obligations.every(obligation => proven.some(constraint => constraint.diagnostic === obligation.diagnostic &&
      constraint.rootDiagnostic === coverage.root && constraint.application === obligation.application));
  };
  const diagnostics = [...records].filter(([, values]) => values.every(covered)).map(([root]) => root);
  return { kind: "resolved", value: Object.freeze({ application: winner.application, diagnostics: Object.freeze(diagnostics) }) };
}
