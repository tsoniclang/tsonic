import type { Node } from "@tsonic/tsts";
import type { SourceInputCallCandidate, SourceInputCallSelection,
} from "../../host-input/call-input.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import type { SourceProducedApplication } from "./application-data.js";
import type { SourceCallCandidateEvaluation } from "./application-data.js";
import { sourceSemanticRefusal } from "./semantic-production.js";
import { sourceProvenDiagnosticRoots } from "./diagnostic-proofs.js";


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
  if (winner.application.argumentDisposition === "skip") return { kind: "resolved", value: Object.freeze({
    application: winner.application, original: winner.candidate.application, diagnostics: Object.freeze([]) }) };
  const applications = new Set(candidates.map(candidate => candidate.application));
  const diagnostics = sourceProvenDiagnosticRoots(candidates.flatMap(candidate => [...candidate.diagnosticCoverage,
    ...candidate.constraints.map(constraint => constraint.rootCoverage)]), winner.proven,
  coverage => selection.kind === "conditional-candidates" && coverage.purpose.kind === "alternative-applicability" &&
    coverage.purpose.invocation === invocation && coverage.obligations.every(obligation => obligation.kind === "applicability" &&
      obligation.application !== undefined && applications.has(obligation.application) && obligation.application.invocation === invocation));
  return { kind: "resolved", value: Object.freeze({ application: winner.application,
    original: winner.candidate.application, diagnostics }) };
}
