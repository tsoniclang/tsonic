import type { Result, UnitRequest } from "../diag/contract.js";
import { hostDiagnosticCode } from "../diag/index.js";
import type { TyId } from "../ids/contract.js";
import type { ConstructionContributionScheme, ConstructionPartDecision, InferenceValue, LiteralConstructionInput, LiteralConstructionPart,
  OperationDecision, RuleOutcome } from "../ir-infer/contract.js";
import type { TypeComponent, TypePublicationWork } from "../ir-types/contract.js";
import { admitTypePublicationStep, nativeCarrierHoldingOf, readType, refuseTypeConstruction } from "../ir-types/index.js";
import type { RulesDeps } from "./contract.js";
import { decideComponentEmbedding } from "./embed.js";
import { mergeErrors, validateValue } from "./errors.js";
import { callerDefect, notDecidedYet } from "./frontier.js";
import { variableOf } from "./schemes.js";

function ok<Value>(value: Value): Result<Value> {
  return { kind: "ok", value, diagnostics: [] };
}

export function constructLiteral(deps: RulesDeps, input: LiteralConstructionInput, work: TypePublicationWork, unit: UnitRequest):
  Result<RuleOutcome<OperationDecision>> {
  const { origin, occurrence } = input.context;
  const start = admitTypePublicationStep(work, 2);
  if (start !== null) return refuseTypeConstruction(work, start, origin, unit);
  const result = input.destination ?? input.result;
  const source = readType(deps.types, input.result.type);
  const product = readType(deps.types, result.type);
  if (input.construction !== "array" || source.kind !== "tuple" || product.kind !== "tuple")
    return notDecidedYet("the selected non-tuple literal construction", origin);
  const native = deps.selectedNativeFacts.carrierHolding;
  const payHolding = admitTypePublicationStep(work, native.length);
  if (payHolding !== null) return refuseTypeConstruction(work, payHolding, origin, unit);
  if (nativeCarrierHoldingOf(native, "tuple") !== "in-place")
    return notDecidedYet("a tuple literal without its selected in-place carrier", origin);
  if (source.elements.length !== input.parts.length || product.elements.length !== input.parts.length
    || input.result.component.kind !== "body" || input.result.component.value.body !== occurrence.body || input.result.component.value.node !== occurrence.node
    || result.component.kind !== "body" || result.component.value.body !== occurrence.body || result.component.value.node !== occurrence.node)
    return callerDefect("a tuple literal requires its exact selected product component and arity", origin);
  const parts: ConstructionPartDecision[] = [];
  const operands: TyId[] = [];
  for (let index = 0; index < input.parts.length; index += 1) {
    const reached = admitTypePublicationStep(work, 2);
    if (reached !== null) return refuseTypeConstruction(work, reached, origin, unit);
    const part = input.parts[index];
    const slot = product.elements[index];
    if (part?.kind !== "element" || part.occurrence.body !== occurrence.body || source.elements[index]?.kind !== "required" || slot?.kind !== "required")
      return callerDefect("a fixed tuple construction requires an actual required operand at its selected slot", origin);
    const destination: TypeComponent = { root: result.component, path: [{ kind: "tuple-element", index }] };
    const embedding = decideComponentEmbedding(deps,
      { type: part.value.type, at: { root: { kind: "body", value: part.occurrence }, path: [] } },
      { type: slot.type, at: destination }, "initialization", part.occurrence, origin);
    if (embedding.kind === "refused") {
      const code = hostDiagnosticCode("TSONIC_CONSTRUCTION_PART_FIT");
      return { kind: "refused", diagnostics: [{ code: { kind: "host", name: code, rendered: code }, severity: "error",
        site: { kind: "source", origin }, source: "rules", evidence: [], arguments: [], related: [], fix: null,
        message: "A tuple operand does not fit its selected slot." }] };
    }
    operands.push(slot.type);
    parts.push({ part: index, source: part.occurrence, destination, member: null, embedding });
  }
  return ok({ kind: "decided", decision: { kind: "selected", operation: { kind: "array-construction", parts },
    operands, result: result.type, execution: { kind: "pure" } } });
}

export function constructionScheme(deps: RulesDeps): ConstructionContributionScheme {
  return {
    enumerate: ({ constraint, group, reference }) => {
      const reads = new Set<number>();
      for (const part of constraint.parts) {
        const variable = variableOf(deps, part.type, constraint.occurrence, group);
        if (variable !== null) reads.add(variable);
      }
      return ok([{ key: { node: constraint.occurrence, candidate: null, role: { kind: "construction" } },
        reads: [...reads].sort((left, right) => left - right), bounds: [], constraint: reference }]);
    },
    evaluate: ({ constraint, evidence, reads, origin, bindings, typeWork, unit }) => {
      const start = admitTypePublicationStep(typeWork);
      if (start !== null) return refuseTypeConstruction(typeWork, start, origin, unit);
      const { parts, occurrence } = constraint;
      const values: InferenceValue[] = [];
      const selected: LiteralConstructionPart[] = [];
      const result = evidence[parts.length + (constraint.destination === null ? 0 : 1)];
      const destination = constraint.destination === null ? null : evidence[parts.length];
      if (evidence.length !== parts.length + (constraint.destination === null ? 1 : 2)
        || result === undefined || result.value.type !== constraint.result || destination === undefined
        || destination !== null && destination.value.type !== constraint.destination)
        return callerDefect("construction requires its actual result and optional destination evidence", origin);
      const finals = new Map(reads.map(row => [row.variable, row]));
      for (let index = 0; index < parts.length; index += 1) {
        const reached = admitTypePublicationStep(typeWork);
        if (reached !== null) return refuseTypeConstruction(typeWork, reached, origin, unit);
        const part = parts[index];
        const source = evidence[index];
        if (part === undefined || source === undefined || source.value.type !== part.type)
          return callerDefect("construction requires its actual authored operand evidence", origin);
        const variable = variableOf(deps, part.type, occurrence, null);
        const actual = variable === null ? source : finals.get(variable);
        if (actual === undefined) return callerDefect("a construction operand requires its actual finalized type", origin);
        validateValue(deps, actual);
        values.push(actual);
        if (part.kind === "property") selected.push({ kind: part.kind, occurrence: part.occurrence, value: actual.value, key: part.key });
        else selected.push({ kind: part.kind, occurrence: part.occurrence, value: actual.value });
      }
      values.push(result);
      if (destination !== null) values.push(destination);
      const error = mergeErrors(values);
      if (error !== null) return ok({ bounds: [], decision: { kind: "error", error }, selectedCandidate: null });
      const constructed = constructLiteral(deps, { context: { occurrence, origin, bindings },
        construction: constraint.construction, parts: selected, destination: destination?.value ?? null, result: result.value }, typeWork, unit);
      if (constructed.kind === "refused") return constructed;
      const decision = constructed.value;
      return { ...constructed, value: { bounds: [], selectedCandidate: null, decision: decision.kind === "decided"
        ? { kind: "construct-literal", operation: decision.decision } : decision } };
    },
  };
}
