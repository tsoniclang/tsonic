import type { Result } from "../diag/contract.js";
import type { Origin, TyId } from "../ids/contract.js";
import type { ConstraintScheme, EmbeddingDecision, LiteralConstraint } from "../ir-infer/contract.js";
import type { LiteralValue } from "../ir-types/contract.js";
import { literalCompatibilityOf, readType, viewTypes } from "../ir-types/index.js";
import type { RulesDeps } from "./contract.js";
import { validateValue } from "./errors.js";
import { callerDefect, notDecidedYet } from "./frontier.js";
import { variableOf } from "./schemes.js";

function ok<Value>(value: Value): Result<Value> {
  return { kind: "ok", value, diagnostics: [] };
}

export function decideLiteralFit(deps: RulesDeps, literal: LiteralValue, destination: TyId, origin: Origin | null): EmbeddingDecision {
  const selected = readType(deps.types, destination);
  if (literal.kind !== "number" || selected.kind !== "primitive" || selected.primitive !== "int64")
    return notDecidedYet("literal materialization outside the selected int64 domain", origin);
  const fit = literalCompatibilityOf(viewTypes(deps.types), destination, literal, deps.selectedNativeFacts, {
    numericRepresentation: "literal-operand", typeOf: type => readType(deps.types, type), admit: () => true,
  });
  if (fit.kind === "compatible") return { kind: "identity" };
  if (fit.kind === "incompatible") return { kind: "refused", reason: "lossy-numeric" };
  return callerDefect("literal fit requires the actual selected int64 domain", origin);
}

export function literalScheme(deps: RulesDeps): ConstraintScheme<LiteralConstraint> {
  return {
    enumerate: ({ constraint, group, reference }) => {
      const variable = variableOf(deps, constraint.destination, constraint.occurrence, group);
      return ok([{
        key: { node: constraint.occurrence, candidate: null, role: { kind: "literal" } },
        reads: variable === null ? [] : [variable], bounds: [], constraint: reference,
      }]);
    },
    evaluate: ({ constraint, evidence, reads }) => {
      const destination = evidence[0];
      if (evidence.length !== 1 || destination?.value.type !== constraint.destination)
        return callerDefect("literal fit requires its one actual destination evidence", null);
      validateValue(deps, destination);
      const variable = variableOf(deps, constraint.destination, constraint.occurrence, null);
      const selected = variable === null ? destination : reads[0];
      if (selected === undefined || (variable === null ? reads.length !== 0 : reads.length !== 1 || reads[0]?.variable !== variable))
        return callerDefect("literal fit must read the actual finalized destination", null);
      return ok({ bounds: [], selectedCandidate: null, decision: selected.error === null
        ? { kind: "literal", embedding: decideLiteralFit(deps, constraint.value, selected.value.type, null) }
        : { kind: "error", error: selected.error } });
    },
  };
}
