import type { BodyId, NodeRef, RawTypeId, SourceNodeRef, TyId } from "../ids/contract.js";
import type { CapturedFact, CheckedValue, HirMemoryGeometryCapture } from "../ir-hir/contract.js";
import type { TypePublicationStop } from "../ir-types/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { RawFact, RawLayoutApplication, RawLayoutQuery, RawMemoryMetadata, RawNodeRef } from "./contract.js";
import type { ConversionResult } from "./type-conversion.js";
import { layoutConstructionArity } from "./source-bodies.js";

type RawConstruction = Extract<RawMemoryMetadata, { readonly kind: "layout-construction" }>;
interface LayoutProjectionDeps {
  readonly admit: () => TypePublicationStop | null;
  readonly bodyOf: (reference: RawNodeRef) => BodyId | null;
  readonly typeOf: (fact: RawFact<RawTypeId>) => ConversionResult<CapturedFact<TyId>>;
}

type Projection = Pick<CheckedValue, "memory" | "observation">;

const available = <Value>(value: Value): CapturedFact<Value> => ({ kind: "available", value });
const missing = (reason: "not-provided" | "incomplete-association"): CapturedFact<never> =>
  ({ kind: "unavailable", reason, causes: [] });

function occurrence(deps: LayoutProjectionDeps, reference: RawNodeRef): NodeRef {
  const body = deps.bodyOf(reference);
  if (body === null) return throwInvariant({ owner: "front", query: null, origin: null,
    message: "A checked layout application retains its actual qualified authored expression." });
  return { body, node: reference.node };
}

function operands(deps: LayoutProjectionDeps, selected: RawLayoutApplication): ConversionResult<readonly SourceNodeRef[]> {
  const rows: SourceNodeRef[] = [];
  for (let index = 0; index < selected.operands.length; index += 1) {
    const stop = deps.admit();
    if (stop !== null) return stop;
    const row = selected.operands[index];
    if (row?.kind !== "value") return { kind: "complete", value: [] };
    rows.push({ kind: "body", value: occurrence(deps, row.expression) });
  }
  return { kind: "complete", value: rows };
}

function construct(deps: LayoutProjectionDeps, selected: RawConstruction): ConversionResult<Projection> {
  const inputs = operands(deps, selected);
  if (inputs.kind !== "complete") return inputs;
  const [first, second, third, fourth, fifth, sixth] = inputs.value;
  const absent = available(null);
  if (first === undefined || second === undefined || third === undefined || fourth === undefined ||
    !layoutConstructionArity(selected.construction, inputs.value.length))
    return { kind: "complete", value: { memory: missing("incomplete-association"), observation: absent } };
  const unavailable = missing("not-provided");
  const site: SourceNodeRef = { kind: "body", value: occurrence(deps, selected.application.invocation) };
  const typeArgument = selected.application.signatureArguments[0];
  const type: ConversionResult<CapturedFact<TyId>> = typeArgument === undefined || selected.construction === "array"
    ? { kind: "complete", value: unavailable }
    : deps.typeOf(typeArgument.argument);
  if (type.kind !== "complete") return type;
  if (selected.construction === "field") {
    const valueArgument = selected.application.signatureArguments[1];
    const value: ConversionResult<CapturedFact<TyId>> = valueArgument === undefined
      ? { kind: "complete", value: unavailable } : deps.typeOf(valueArgument.argument);
    if (value.kind !== "complete") return value;
    return { kind: "complete", value: { observation: absent, memory: available({
      kind: "field", occurrence: site, bindings: unavailable, source: type.value, selector: first, selection: unavailable,
      key: unavailable, origins: unavailable, selectedDeclarations: unavailable, primary: unavailable, value: value.value,
      fieldLayoutExpression: fourth, fieldLayout: unavailable, byteOffsetExpression: second, byteOffset: unavailable,
      byteAlignmentExpression: third, byteAlignment: unavailable,
    }) } };
  }
  const geometry: HirMemoryGeometryCapture = { source: type.value, dataLayoutExpression: first, dataLayout: unavailable,
    byteSizeExpression: second, byteSize: unavailable, byteAlignmentExpression: third, byteAlignment: unavailable,
    strideExpression: fourth, stride: unavailable };
  return { kind: "complete", value: { observation: absent, memory: selected.construction === "array"
    ? available({ kind: "array", occurrence: site, bindings: unavailable, geometry,
      extentExpression: sixth ?? null, length: unavailable, runtimeBase: unavailable,
      elementExpression: fifth ?? null, element: unavailable })
    : available({ kind: "value", occurrence: site, bindings: unavailable, geometry,
      fieldExpressions: inputs.value.slice(4), fields: unavailable }) } };
}

function observe(deps: LayoutProjectionDeps, selected: RawLayoutQuery, result: CapturedFact<TyId>): ConversionResult<Projection> {
  const inputs = operands(deps, selected);
  if (inputs.kind !== "complete") return inputs;
  const [rawOperand, rawSelector] = inputs.value;
  const field = selected.operation === "field-offset";
  const absent = available(null);
  if (rawOperand?.kind !== "body" || inputs.value.length !== (field ? 2 : 1) || field && rawSelector?.kind !== "body")
    return { kind: "complete", value: { memory: absent, observation: missing("incomplete-association") } };
  const unavailable = missing("not-provided");
  return { kind: "complete", value: { memory: absent, observation: available({
    occurrence: occurrence(deps, selected.application.invocation), operation: selected.operation, bindings: unavailable,
    operand: rawOperand.value, layout: unavailable, selector: rawSelector ?? null,
    field: field ? unavailable : absent, result, value: unavailable,
  }) } };
}

export function lowerLayoutApplication(deps: LayoutProjectionDeps, selected: RawConstruction | RawLayoutQuery,
  result: CapturedFact<TyId>): ConversionResult<Projection> {
  return "construction" in selected ? construct(deps, selected) : observe(deps, selected, result);
}
