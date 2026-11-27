import type { Result } from "../diag/contract.js";
import type { Origin, TyId } from "../ids/contract.js";
import type { EmbeddingDecision, LiteralConstraint, PaidConstraintScheme, RuleWork } from "../ir-infer/contract.js";
import type { LiteralValue } from "../ir-types/contract.js";
import { admitTypePublicationStep, isNativeIntegerPrimitive, readType, refuseTypeConstruction } from "../ir-types/index.js";
import type { RulesDeps } from "./contract.js";
import { validateValue } from "./errors.js";
import { callerDefect, notDecidedYet } from "./frontier.js";
import { variableOf } from "./schemes.js";
import { integerLiteralFit } from "./embed.js";

function ok<Value>(value: Value): Result<Value> {
  return { kind: "ok", value, diagnostics: [] };
}

export function decideLiteralFit(deps: RulesDeps, literal: LiteralValue, destination: TyId, origin: Origin, work: RuleWork): Result<EmbeddingDecision> {
  const stopped = admitTypePublicationStep(work.typeWork, 0);
  if (stopped !== null) return refuseTypeConstruction(work.typeWork, stopped, origin, work.unit);
  const selected = readType(deps.types, destination);
  if (literal.kind !== "number" && literal.kind !== "bigint" || selected.kind !== "primitive" || !isNativeIntegerPrimitive(selected.primitive))
    return notDecidedYet("literal materialization outside the selected native integer domain", origin);
  const fit = integerLiteralFit(deps, literal, destination, work);
  if (fit === "literal-fit") return ok({ kind: "identity" });
  if (fit === "lossy-numeric") return ok({ kind: "refused", reason: fit });
  if (fit !== null) return refuseTypeConstruction(work.typeWork, fit, origin, work.unit);
  return notDecidedYet("literal materialization without its selected native integer representation", origin);
}

export function literalScheme(deps: RulesDeps): PaidConstraintScheme<LiteralConstraint> {
  return {
    enumerate: ({ constraint, group, reference }) => {
      const variable = variableOf(deps, constraint.destination, constraint.occurrence, group);
      return ok([{
        key: { node: constraint.occurrence, candidate: null, role: { kind: "literal" } },
        reads: variable === null ? [] : [variable], bounds: [], constraint: reference,
      }]);
    },
    evaluate: ({ constraint, evidence, reads, origin }, work) => {
      const destination = evidence[0];
      if (evidence.length !== 1 || destination?.value.type !== constraint.destination)
        return callerDefect("literal fit requires its one actual destination evidence", null);
      validateValue(deps, destination);
      const variable = variableOf(deps, constraint.destination, constraint.occurrence, null);
      const selected = variable === null ? destination : reads[0];
      if (selected === undefined || (variable === null ? reads.length !== 0 : reads.length !== 1 || reads[0]?.variable !== variable))
        return callerDefect("literal fit must read the actual finalized destination", null);
      if (selected.error !== null) return ok({ bounds: [], selectedCandidate: null, decision: { kind: "error", error: selected.error } });
      const fit = decideLiteralFit(deps, constraint.value, selected.value.type, origin, work);
      if (fit.kind === "refused") return fit;
      return ok({ bounds: [], selectedCandidate: null, decision: { kind: "literal", embedding: fit.value } });
    },
  };
}
