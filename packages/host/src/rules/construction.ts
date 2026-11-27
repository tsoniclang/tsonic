import type { Result } from "../diag/contract.js";
import { hostDiagnosticCode } from "../diag/index.js";
import type { TyId } from "../ids/contract.js";
import type { ConstructionContributionScheme, ConstructionPartDecision, InferenceValue, LiteralConstructionInput, LiteralConstructionPart,
  NativeArrayConstructionPart, OperationDecision, RuleOutcome, RuleWork, VariableBound } from "../ir-infer/contract.js";
import type { TypeComponent, TypeTerm } from "../ir-types/contract.js";
import { admitTypePublicationStep, internType, internTypeGraph, nativeArrayExtentOf, nativeCarrierHoldingOf, readType, refuseTypeConstruction, viewTypes } from "../ir-types/index.js";
import type { RulesDeps } from "./contract.js";
import { componentEmbedding, decideComponentEmbedding } from "./embed.js";
import { mergeErrors, validateValue } from "./errors.js";
import { callerDefect, notDecidedYet } from "./frontier.js";
import { variableOf } from "./schemes.js";

function ok<Value>(value: Value): Result<Value> {
  return { kind: "ok", value, diagnostics: [] };
}

function arrayConstruction(deps: RulesDeps, input: LiteralConstructionInput, source: Extract<TypeTerm, { readonly kind: "array" }>,
  destination: Extract<TypeTerm, { readonly kind: "array" }>, work: RuleWork): Result<RuleOutcome<OperationDecision>> {
  const { occurrence, origin } = input.context;
  const { typeWork, unit } = work;
  const reject = (message: string): Result<never> => {
    const code = hostDiagnosticCode("TSONIC_ARRAY_CONSTRUCTION");
    return { kind: "refused", diagnostics: [{ code: { kind: "host", name: code, rendered: code }, severity: "error",
      site: { kind: "source", origin }, source: "rules", evidence: [], arguments: [], related: [], fix: null, message }] };
  };
  const root = (input.destination ?? input.result).component;
  if (input.result.component.kind !== "body" || input.result.component.value.body !== occurrence.body
    || input.result.component.value.node !== occurrence.node || root.kind !== "body"
    || root.value.body !== occurrence.body || root.value.node !== occurrence.node)
    return callerDefect("a native array construction must own its checked and selected result components", origin);
  const policyAdmission = admitTypePublicationStep(typeWork, 4);
  if (policyAdmission !== null) return refuseTypeConstruction(typeWork, policyAdmission, origin, unit);
  const facts = deps.selectedNativeFacts;
  const policy = facts.arrayConstruction;
  if (policy === null) return reject("The selected target does not supply exact-length array construction.");
  const rowAdmission = admitTypePublicationStep(typeWork, facts.arrayExtents.length + facts.carrierHolding.length);
  if (rowAdmission !== null) return refuseTypeConstruction(typeWork, rowAdmission, origin, unit);
  const extent = nativeArrayExtentOf(facts.arrayExtents, "array");
  const holding = nativeCarrierHoldingOf(facts.carrierHolding, "array");
  if (extent === null || holding === null) return reject("The selected array construction requires its actual native extent and storage laws.");

  let range: TyId | null = null;
  let scalar: TyId | null = null;
  let literalBase: TyId | null = null;
  let scalarConflict = false;
  let literalConflict = false;
  for (let position = 0; position < input.parts.length; position += 1) {
    const reached = admitTypePublicationStep(typeWork, 2);
    if (reached !== null) return refuseTypeConstruction(typeWork, reached, origin, unit);
    const part = input.parts[position];
    if (part === undefined || part.kind === "property" || part.occurrence.body !== occurrence.body)
      return callerDefect("a native array requires an actual ordered element or spread of this body", origin);
    const type = readType(deps.types, part.value.type);
    if (part.kind === "spread") {
      if (range !== null || type.kind !== "array")
        return reject("The exact-length plan requires at most one reached native array range.");
      range = type.element;
    } else if (input.destination === null) {
      if (type.kind === "literal") {
        if (literalBase !== null && literalBase !== type.base) literalConflict = true;
        literalBase ??= type.base;
      } else {
        if (scalar !== null && scalar !== part.value.type) scalarConflict = true;
        scalar ??= part.value.type;
      }
    }
  }
  const element = input.destination !== null ? destination.element : range
    ?? (scalar === null ? literalConflict ? null : literalBase : scalarConflict ? null : scalar);
  if (element === null) return reject("Array construction requires one selected native element carrier.");
  if (range !== null && range !== element)
    return reject("The selected contiguous range and destination must have identical element storage.");
  const operands: TyId[] = [];
  const parts: NativeArrayConstructionPart[] = [];
  const slot: TypeComponent = { root, path: [{ kind: "array-element" }] };
  for (let position = 0; position < input.parts.length; position += 1) {
    const reached = admitTypePublicationStep(typeWork, 2, 2);
    if (reached !== null) return refuseTypeConstruction(typeWork, reached, origin, unit);
    const part = input.parts[position];
    if (part === undefined || part.kind === "property") return callerDefect("a native array requires its complete parts", origin);
    if (part.kind === "spread") {
      operands.push(part.value.type);
      parts.push({ kind: "spread", source: part.occurrence });
    } else {
      const fit = componentEmbedding(deps,
        { type: part.value.type, at: { root: { kind: "body", value: part.occurrence }, path: [] } },
        { type: element, at: slot }, origin, work);
      if (fit?.kind === "refused") return fit;
      if (fit === null || fit.value.kind === "refused") return reject("An array element does not fit its selected native storage.");
      operands.push(element);
      parts.push({ kind: "element", source: part.occurrence, embedding: fit.value });
    }
  }
  const completed = admitTypePublicationStep(typeWork, 1, 1);
  if (completed !== null) return refuseTypeConstruction(typeWork, completed, origin, unit);
  let result = input.destination?.type;
  if (result === undefined) {
    const table = viewTypes(deps.types);
    const published = internTypeGraph({ types: deps.types, work: typeWork }, { typeBase: table.terms.length, signatureBase: table.signatures.length,
      terms: [{ kind: "array", element, readonly: source.readonly }], signatures: [] });
    if (published.kind !== "complete") return refuseTypeConstruction(typeWork, published, origin, unit);
    result = published.value.types[0];
    if (result === undefined) return callerDefect("array result publication must retain its one actual type", origin);
  }
  return ok({ kind: "decided", decision: { kind: "selected", operation: { kind: "exact-array-construction", extent, holding,
    extentFailure: policy.extentFailure, allocationFailure: facts.allocationFailure === "abort" ? "abort" : "unwind", parts },
    operands, result, execution: { kind: "array-initialization" } } });
}

export function constructLiteral(deps: RulesDeps, input: LiteralConstructionInput, work: RuleWork):
  Result<RuleOutcome<OperationDecision>> {
  const { origin, occurrence } = input.context;
  const { typeWork, unit } = work;
  const start = admitTypePublicationStep(typeWork, 2);
  if (start !== null) return refuseTypeConstruction(typeWork, start, origin, unit);
  const result = input.destination ?? input.result;
  const source = readType(deps.types, input.result.type);
  const product = readType(deps.types, result.type);
  if (input.construction === "array" && source.kind === "array" && product.kind === "array")
    return arrayConstruction(deps, input, source, product, work);
  if (input.construction !== "array" || source.kind !== "tuple" || product.kind !== "tuple")
    return notDecidedYet("the selected non-tuple literal construction", origin);
  const native = deps.selectedNativeFacts.carrierHolding;
  const payHolding = admitTypePublicationStep(typeWork, native.length);
  if (payHolding !== null) return refuseTypeConstruction(typeWork, payHolding, origin, unit);
  if (nativeCarrierHoldingOf(native, "tuple") !== "in-place")
    return notDecidedYet("a tuple literal without its selected in-place carrier", origin);
  if (source.elements.length !== input.parts.length || product.elements.length !== input.parts.length
    || input.result.component.kind !== "body" || input.result.component.value.body !== occurrence.body || input.result.component.value.node !== occurrence.node
    || result.component.kind !== "body" || result.component.value.body !== occurrence.body || result.component.value.node !== occurrence.node)
    return callerDefect("a tuple literal requires its exact selected product component and arity", origin);
  const parts: ConstructionPartDecision[] = [];
  const operands: TyId[] = [];
  for (let index = 0; index < input.parts.length; index += 1) {
    const reached = admitTypePublicationStep(typeWork, 2);
    if (reached !== null) return refuseTypeConstruction(typeWork, reached, origin, unit);
    const part = input.parts[index];
    const slot = product.elements[index];
    if (part?.kind !== "element" || part.occurrence.body !== occurrence.body || source.elements[index]?.kind !== "required" || slot?.kind !== "required")
      return callerDefect("a fixed tuple construction requires an actual required operand at its selected slot", origin);
    const destination: TypeComponent = { root: result.component, path: [{ kind: "tuple-element", index }] };
    const embedding = decideComponentEmbedding(deps,
      { type: part.value.type, at: { root: { kind: "body", value: part.occurrence }, path: [] } },
      { type: slot.type, at: destination }, "initialization", part.occurrence, origin, work);
    if (embedding.kind === "refused") return embedding;
    if (embedding.value.kind === "refused") {
      const code = hostDiagnosticCode("TSONIC_CONSTRUCTION_PART_FIT");
      return { kind: "refused", diagnostics: [{ code: { kind: "host", name: code, rendered: code }, severity: "error",
        site: { kind: "source", origin }, source: "rules", evidence: [], arguments: [], related: [], fix: null,
        message: "A tuple operand does not fit its selected slot." }] };
    }
    operands.push(slot.type);
    parts.push({ part: index, source: part.occurrence, destination, member: null, embedding: embedding.value });
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
      const result = constraint.inferredResult === null ? null : variableOf(deps, constraint.inferredResult, constraint.occurrence, group);
      if (constraint.inferredResult !== null && (result === null || constraint.construction !== "array" || constraint.destination !== null))
        return callerDefect("only an uncontextual array owns an inferred construction result", null);
      return ok([{ key: { node: constraint.occurrence, candidate: null, role: { kind: "construction" } },
        reads: [...reads].sort((left, right) => left - right), bounds: result === null ? [] : [result], constraint: reference }]);
    },
    evaluate: ({ constraint, evidence, reads, origin, bindings, typeWork, unit, contribution }) => {
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
      const variable = constraint.inferredResult === null ? null : variableOf(deps, constraint.inferredResult, occurrence, null);
      const boundsOf = (type: TyId, error: InferenceValue["error"]): readonly VariableBound[] => variable === null ? [] : [{
        variable, contribution: contribution.key, kind: "producer", value: { type, component: result.value.component,
          category: { kind: "dynamic" }, numeric: null, sum: null, nominal: null, pointer: null }, error,
      }];
      const error = mergeErrors(values);
      if (error !== null) return ok({ bounds: variable === null ? [] : boundsOf(internType(deps.types, { kind: "error" }), error),
        decision: { kind: "error", error }, selectedCandidate: null });
      const constructed = constructLiteral(deps, { context: { occurrence, origin, bindings },
        construction: constraint.construction, parts: selected, destination: destination?.value ?? null, result: result.value }, { typeWork, unit });
      if (constructed.kind === "refused") return constructed;
      const decision = constructed.value;
      return { ...constructed, value: { bounds: decision.kind === "decided" ? boundsOf(decision.decision.result, null) : [],
        selectedCandidate: null, decision: decision.kind === "decided"
        ? { kind: "construct-literal", operation: decision.decision } : decision } };
    },
  };
}
