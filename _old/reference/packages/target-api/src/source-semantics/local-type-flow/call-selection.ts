import type { Node } from "@tsonic/tsts";
import type { SourceInputCallSelection } from "../../host-input/call-input.js";
import type { SourceTypeComponent } from "../../public/source/contracts.js";
import type { SourceProductionResult } from "../../source-model/production.js";
import type { SourceCallAttempt, SourceProducedApplication, SourceCallCandidateEvaluation } from "./application-data.js";
import { sourceSemanticRefusal } from "./semantic-production.js";
import { sourceProvenDiagnosticRoots } from "./diagnostic-proofs.js";


export function selectSourceCallCandidate(selection: SourceInputCallSelection, invocation: Node, dependency: SourceTypeComponent,
  evaluate: (attempt: SourceCallAttempt) => SourceProductionResult<SourceCallCandidateEvaluation>): SourceProductionResult<SourceProducedApplication> {
  const refuse = (message: string) => sourceSemanticRefusal(invocation, message, "TSONIC_LOCAL_TYPE_GENERIC");
  if (selection.kind === "untyped") return refuse("This application has no original callable candidate to authenticate.");
  const candidates = selection.kind === "applicable" ? [selection.selection] : selection.candidates;
  const order = selection.declarationOrder;
  if (order.kind !== "available") return { kind: "pending", dependencies: Object.freeze([dependency]) };
  if (new Set(order.signatures).size !== order.signatures.length ||
    candidates.some(candidate => !order.signatures.includes(candidate.application.signature)) ||
    selection.kind === "conditional-candidates" && order.signatures.length !== candidates.length)
    throw new Error("Original declaration order must retain the complete authentic candidate signature inventory.");
  const invocationInput = selection.kind === "applicable" ? selection.selection : undefined;
  let winner: Extract<SourceCallCandidateEvaluation, { readonly kind: "applicable" }> | undefined;
  for (const signature of order.signatures) {
    const matching = candidates.filter(candidate => candidate.application.signature === signature);
    if (matching.length > 1 || selection.kind === "conditional-candidates" && matching.length !== 1)
      throw new Error("An original declaration-order slot retains at most its one authentic observed candidate.");
    const observed = matching[0];
    const source = observed ?? invocationInput;
    if (source === undefined) throw new Error("A Source attempt needs authentic original invocation inputs, never a fabricated checker candidate.");
    if (source.identity.invocation !== invocation || source.application.invocation !== invocation)
      throw new Error("Original invocation inputs must belong to their exact application.");
    const attempt: SourceCallAttempt = Object.freeze({ signature, invocation: source.application,
      arguments: source.sourceArguments, observed });
    const result = evaluate(attempt);
    if (result.kind !== "resolved") return result;
    if (result.value.attempt !== attempt) throw new Error("A Source applicability result must retain its exact original-signature attempt.");
    if (result.value.kind === "not-applicable") continue;
    winner = result.value;
    break;
  }
  if (winner === undefined) return refuse("No original declaration-order candidate is fully Source applicable.");
  if (winner.application.identity.invocation !== invocation)
    throw new Error("A Source winner retains its exact original invocation.");
  if (winner.application.argumentDisposition === "skip") return { kind: "resolved", value: Object.freeze({
    application: winner.application, diagnostics: Object.freeze([]) }) };
  const applications = new Set(candidates.map(candidate => candidate.application));
  const diagnostics = sourceProvenDiagnosticRoots(candidates.flatMap(candidate => [...candidate.diagnosticCoverage,
    ...candidate.constraints.map(constraint => constraint.rootCoverage)]), winner.proven,
  coverage => selection.kind === "conditional-candidates" && coverage.purpose.kind === "alternative-applicability" &&
    coverage.purpose.invocation === invocation && coverage.obligations.every(obligation => obligation.kind === "applicability" &&
      obligation.application !== undefined && applications.has(obligation.application) && obligation.application.invocation === invocation));
  return { kind: "resolved", value: Object.freeze({ application: winner.application, diagnostics }) };
}
