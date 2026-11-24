import type { BodyId, NodeRef, RawTypeId, SourceNodeRef, TyId } from "../ids/contract.js";
import type { CapturedFact, CheckedValue, HirMemoryGeometryCapture } from "../ir-hir/contract.js";
import type { TypePublicationStop } from "../ir-types/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { RawFact, RawLayoutApplication, RawLayoutOperand, RawLayoutQuery, RawMemoryMetadata, RawNodeRef } from "./contract.js";
import type { ConversionResult } from "./type-conversion.js";

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
  const prepaid = deps.admit();
  if (prepaid !== null) return prepaid;
  const absent = available(null);
  const unavailable = missing("not-provided");
  const qualify = (operand: RawLayoutOperand): SourceNodeRef => ({ kind: "body", value: occurrence(deps, operand.expression) });
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
      kind: "field", occurrence: site, bindings: unavailable, source: type.value, selector: qualify(selected.selector), selection: unavailable,
      key: unavailable, origins: unavailable, selectedDeclarations: unavailable, primary: unavailable, value: value.value,
      fieldLayoutExpression: qualify(selected.fieldLayout), fieldLayout: unavailable, byteOffsetExpression: qualify(selected.byteOffset), byteOffset: unavailable,
      byteAlignmentExpression: qualify(selected.byteAlignment), byteAlignment: unavailable,
    }) } };
  }
  const actual = selected.geometry;
  const geometry: HirMemoryGeometryCapture = { source: type.value, dataLayoutExpression: qualify(actual.dataLayout), dataLayout: unavailable,
    byteSizeExpression: qualify(actual.byteSize), byteSize: unavailable, byteAlignmentExpression: qualify(actual.byteAlignment), byteAlignment: unavailable,
    strideExpression: qualify(actual.stride), stride: unavailable };
  if (selected.construction === "array") return { kind: "complete", value: { observation: absent, memory:
    available({ kind: "array", occurrence: site, bindings: unavailable, geometry,
      extentExpression: qualify(selected.length), length: unavailable, runtimeBase: unavailable,
      elementExpression: qualify(selected.element), element: unavailable }) } };
  const fieldExpressions: SourceNodeRef[] = [];
  for (let index = 0; index < selected.fields.length; index += 1) {
    const stop = deps.admit();
    if (stop !== null) return stop;
    const field = selected.fields[index];
    if (field === undefined) return throwInvariant({ owner: "front", query: null, origin: null,
      message: "A checked value layout retains its dense authored field operand inventory." });
    fieldExpressions.push(qualify(field));
  }
  return { kind: "complete", value: { observation: absent, memory: available({
    kind: "value", occurrence: site, bindings: unavailable, geometry, fieldExpressions, fields: unavailable,
  }) } };
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
