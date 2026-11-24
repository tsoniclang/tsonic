import type { DataflowAccount } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { ErrorValue, Result, UnitRef, UnitRequest, UnitResult } from "../diag/contract.js";
import { hostDiagnosticCode, resourceLimitDiagnostic, throwInvariant } from "../diag/index.js";
import type { NodeRef, Origin, SourceNodeRef } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { CheckedLayoutSource, HirObservationCapture } from "../ir-hir/contract.js";
import { resolveCheckedLayout } from "../ir-hir/index.js";
import type { MetadataKey } from "../ir-facts/contract.js";
import { admitArtifactIdentity } from "../ir-facts/index.js";
import type { BodyInstance, ConstantReference, TypeTable } from "../ir-types/contract.js";
import { artifactBindingsKey, instanceKey } from "../ir-types/index.js";
import type { LayoutAnswer, LayoutDeclaration, LayoutDeps, LayoutObservation, LayoutPause, LayoutRequest, ObservedLayout, ReadyLayout } from "../metadata/contract.js";
import type { Query } from "../query/contract.js";
import type { DeclaredSignatureErrorData } from "../decls/contract.js";
import type { HostAnalysisInputs } from "./contract.js";
import type { SourceSemanticInputs, SourceSemanticWitness } from "./semantic-queries.js";
import type { TypedSourceBarrier } from "./typed-barrier.js";
import type { Route } from "./driver.js";
import { defineQuery, factRoute } from "./driver.js";
import { analysisStop } from "./analysis-stop.js";
import { pipelineWiring } from "./wiring.js";

type LayoutQuery<Key, Value> = Query<SourceSemanticInputs, Key, Value, SourceSemanticWitness, DeclaredSignatureErrorData>;
type LayoutRoute<Answer> = Route<SourceSemanticInputs, Answer, SourceSemanticWitness, DeclaredSignatureErrorData>;
type Refusal = Extract<Result<never>, { readonly kind: "refused" }>;
type LayoutRequestRow = { readonly identity: string; readonly key: MetadataKey; readonly source: CheckedLayoutSource };
export interface ObservationDemand {
  readonly instance: BodyInstance;
  readonly at: NodeRef;
}

export interface PreparedObservation extends ObservedLayout {
  readonly demand: ObservationDemand;
  readonly capture: HirObservationCapture;
}

type PreparedObservationKey = ObservationDemand & { readonly identity: string };
type ObservationPause = { readonly demand: ObservationDemand; readonly capture: HirObservationCapture;
  readonly operation: LayoutObservation; readonly origin: Origin };
type ObservationAnswer = { readonly kind: "ready"; readonly layout: ReadyLayout }
  | { readonly kind: "error"; readonly unit: UnitRef };

export const layoutIdentity = (key: MetadataKey): string => encodeKey([key.definition, artifactBindingsKey(key.bindings)]);

function fail(message: string): never {
  return throwInvariant({ owner: "pipeline", query: null, origin: null, message });
}

function refused(origin: Origin, message: string): Refusal {
  const code = hostDiagnosticCode("TSONIC_CONSTANT_EVALUATION_FAILED");
  return { kind: "refused", diagnostics: [{ code: { kind: "host", name: code, rendered: code }, severity: "error",
    site: { kind: "source", origin }, source: "metadata", message, evidence: [], arguments: [], related: [], fix: null }] };
}

function ready<Value extends PreparedObservation | ErrorValue>(value: Value): UnitResult<Value> {
  return { kind: "ok", value, diagnostics: [], emissions: [],
    positions: [{ position: { kind: "result" }, error: "kind" in value ? value : null }] };
}

export function createLayoutQueries(inputs: HostAnalysisInputs, typed: TypedSourceBarrier, table: TypeTable,
  account: DataflowAccount, unit: UnitRequest,
  constant: (request: Extract<LayoutRequest, { readonly kind: "constant" }>) => LayoutRoute<LayoutAnswer>) {
  const { source, database } = typed;
  const sources = source.checked;
  const pay = (work: number, records: number) => chargeWork(account, work) ?? (records === 0 ? null : chargeResultEntries(account, records));
  const admit = (work: number, records: number) => {
    const stop = pay(work, records);
    return stop === null ? null : analysisStop(stop, unit);
  };
  const admitKey = (key: MetadataKey) => chargeWork(account, key.definition.length) ?? admitArtifactIdentity(key.bindings, account);
  const deps: LayoutDeps = { admit, limits: inputs.limits.metadata, nativeFacts: inputs.snapshot.nativeFacts, typeOf: type => table.terms[type] ?? null,
    limit: (origin, axis, maximum) => ({ kind: "refused", diagnostics: [resourceLimitDiagnostic({
      owner: "metadata", limit: axis === "work" ? "metadata.maximumWork" : "metadata.maximumGeometryBits",
      maximum, site: { kind: "source", origin }, unit: { request: unit, position: { kind: "result" } },
    })] }),
    matchesKey: (requested, delivered) => {
      const stop = admitKey(requested) ?? admitKey(delivered);
      return stop === null ? { kind: "complete", matches: layoutIdentity(requested) === layoutIdentity(delivered) } : analysisStop(stop, unit);
    },
  };
  let descriptors: Map<string, LayoutRequestRow> | null = null;
  const resolve = (reference: SourceNodeRef | null, origin: Origin): Result<LayoutRequestRow> => {
    if (reference === null) return refused(origin, "A layout requires its actual checked descriptor operand.");
    const selected = resolveCheckedLayout({ ...sources, bindingOf: source.bindingOf, admit: pay }, reference);
    if (selected.kind !== "complete") return analysisStop(selected.stop, unit);
    if (selected.value === null) return refused(origin, "A layout requires an immutable checked descriptor, not a runtime value.");
    const setup = admit(1, 1);
    if (setup !== null) return setup;
    const scope = source.descriptions.get(selected.value.definition)?.generics;
    if (scope === undefined || scope.classParameters.length + scope.methodParameters.length
      + scope.capturedParameters.length + scope.selfOwners.length !== 0)
      return refused(origin, "A layout descriptor requires its actual closed lexical bindings.");
    const key: MetadataKey = { definition: selected.value.definition, bindings: { kind: "parametric" } };
    const paid = admitKey(key);
    if (paid !== null) return analysisStop(paid, unit);
    const identity = layoutIdentity(key);
    const previous = descriptors?.get(identity);
    if (previous !== undefined) {
      if (previous.source.node !== selected.value.node) return fail("A layout identity can retain only its actual checked source.");
      return { kind: "ok", diagnostics: [], value: previous };
    }
    const retained = admit(0, descriptors === null ? 3 : 2);
    if (retained !== null) return retained;
    const row = { identity, key, source: selected.value };
    (descriptors ??= new Map()).set(identity, row);
    return { kind: "ok", diagnostics: [], value: row };
  };
  const initializer = (reference: SourceNodeRef | null, origin: Origin,
    context: "compile-time" | "fixed-array-extent"): Result<ConstantReference> => {
    const stop = admit(1, 2);
    if (stop !== null) return stop;
    if (reference?.kind !== "body" || source.layoutOperands?.has(reference.value.body) !== true
      || sources.bodies.get(reference.value.body)?.root !== sources.nodeOf(reference))
      return refused(origin, "Layout geometry requires its exact placed authored constant operand.");
    return { kind: "ok", diagnostics: [], value: { context, initializer: { body: reference.value.body, bindings: {
      kind: "instantiated", bindings: { capturedBindings: [], classBindings: [], methodBindings: [], selfBindings: [] },
    } } } };
  };
  const declarationOf = (row: LayoutRequestRow): Result<LayoutDeclaration> => {
    const stop = admit(1, 1);
    if (stop !== null) return stop;
    const { capture, node } = row.source;
    const origin = node.origin;
    const common = { key: row.key, occurrence: capture.occurrence, origin };
    if (capture.kind === "data-layout") {
      if (capture.fingerprint.kind !== "available" || capture.byteOrder.kind !== "available" || capture.addressWidth.kind !== "available")
        return refused(origin, "The actual registered data layout must supply its complete ABI geometry.");
      return { kind: "ok", diagnostics: [], value: { ...common, kind: "data-layout", fingerprint: capture.fingerprint.value,
        byteOrder: capture.byteOrder.value, addressWidth: capture.addressWidth.value } };
    }
    if (capture.kind === "field") {
      if (capture.source.kind !== "available" || capture.value.kind !== "available" || capture.selection.kind !== "available"
        || capture.key.kind !== "available" || capture.origins.kind !== "available" || capture.selectedDeclarations.kind !== "available"
        || capture.primary.kind !== "available" || capture.bindings.kind !== "available")
        return refused(origin, "A field layout requires its actual checked member and native storage selection.");
      const child = resolve(capture.fieldLayoutExpression, origin);
      if (child.kind === "refused") return child;
      const offset = initializer(capture.byteOffsetExpression, origin, "compile-time");
      if (offset.kind === "refused") return offset;
      const alignment = initializer(capture.byteAlignmentExpression, origin, "compile-time");
      if (alignment.kind === "refused") return alignment;
      return { kind: "ok", diagnostics: [], value: { ...common, kind: "field", owner: capture.source.value, value: capture.value.value,
        selector: capture.selector, selection: capture.selection.value, child: child.value.key, byteOffset: offset.value, byteAlignment: alignment.value,
        member: { key: capture.key.value, origins: capture.origins.value, selectedDeclarations: capture.selectedDeclarations.value,
          primary: capture.primary.value, bindings: capture.bindings.value } } };
    }
    const geometry = capture.geometry;
    const abi = resolve(geometry.dataLayoutExpression, origin);
    if (abi.kind === "refused") return abi;
    const byteSize = initializer(geometry.byteSizeExpression, origin, "compile-time");
    if (byteSize.kind === "refused") return byteSize;
    const byteAlignment = initializer(geometry.byteAlignmentExpression, origin, "compile-time");
    if (byteAlignment.kind === "refused") return byteAlignment;
    const stride = initializer(geometry.strideExpression, origin, "compile-time");
    if (stride.kind === "refused") return stride;
    if (geometry.source.kind !== "available") return refused(origin, capture.kind === "array"
      ? "An array layout requires its exact selected fixed-array type and nonnegative literal extent."
      : "A layout requires its exact selected checked source type.");
    const layout = { ...common, source: geometry.source.value, abi: abi.value.key,
      measures: { byteSize: byteSize.value, byteAlignment: byteAlignment.value, stride: stride.value } };
    if (capture.kind === "array") {
      const length = initializer(capture.extentExpression, origin, "fixed-array-extent");
      if (length.kind === "refused") return length;
      const element = resolve(capture.elementExpression, origin);
      if (element.kind === "refused") return element;
      if (capture.runtimeBase.kind !== "available")
        return refused(origin, "An array layout requires its actual selected native extent carrier.");
      return { kind: "ok", diagnostics: [], value: { ...layout, kind: "array", length: length.value,
        element: element.value.key, runtimeBase: capture.runtimeBase.value } };
    }
    const fields: MetadataKey[] = [];
    for (let index = 0; index < capture.fieldExpressions.length; index += 1) {
      const fieldRead = admit(1, 1);
      if (fieldRead !== null) return fieldRead;
      const field = resolve(capture.fieldExpressions[index] ?? null, origin);
      if (field.kind === "refused") return field;
      fields.push(field.value.key);
    }
    return { kind: "ok", diagnostics: [], value: { ...layout, kind: "value", fields } };
  };
  const layoutUnit = (row: LayoutRequestRow): UnitRef => ({ request: { query: "layoutOf", key: row.identity }, position: { kind: "result" } });
  const layout: LayoutQuery<LayoutRequestRow, ReadyLayout | ErrorValue> = defineQuery<
    SourceSemanticInputs, LayoutRequestRow, ReadyLayout | ErrorValue, LayoutRequest, LayoutAnswer, LayoutPause,
    SourceSemanticWitness, DeclaredSignatureErrorData
  >({
    name: "layoutOf", keyData: row => row.identity, answerPolicy: { kind: "refusal-only" },
    producer: {
      start: (base, row) => {
        if (base !== database.inputs || descriptors?.get(row.identity) !== row)
          return fail("Layout requires the actual admitted descriptor demand.");
        const declaration = declarationOf(row);
        return declaration.kind === "refused" ? { kind: "done", value: declaration } : pipelineWiring.metadata.layoutOf(deps, declaration.value);
      },
      resume: (paused, answers) => pipelineWiring.metadata.resumeLayout(deps, paused, answers),
    },
    route: request => {
      if (request.kind === "constant") return constant(request);
      const stop = admitKey(request.key);
      if (stop !== null) return { way: "abandon", diagnostics: analysisStop(stop, unit).diagnostics };
      const selected = descriptors?.get(layoutIdentity(request.key));
      if (selected === undefined) return fail("A descriptor dependency retains its actual prepared checked input.");
      return factRoute(layout, selected, value => value.kind === "error"
        ? { kind: "grounded-error", unit: layoutUnit(selected), request } : { kind: "descriptor", value, request });
    },
    witness: (_request, paused) => ({ kind: "constant-demand", origin: paused.declaration.origin }),
  });
  const observation: LayoutQuery<PreparedObservationKey, PreparedObservation | ErrorValue> = defineQuery<
    SourceSemanticInputs, PreparedObservationKey, PreparedObservation | ErrorValue, LayoutRequestRow, ObservationAnswer, ObservationPause,
    SourceSemanticWitness, DeclaredSignatureErrorData
  >({
    name: "observationOf", keyData: row => row.identity, answerPolicy: { kind: "refusal-only" },
    producer: {
      start: (base, demand) => {
        if (base !== database.inputs || demand.instance.body !== demand.at.body)
          return fail("An observation requires the actual qualified executing body.");
        const stopped = admit(1, 2);
        if (stopped !== null) return { kind: "done", value: stopped };
        const node = sources.nodeOf({ kind: "body", value: demand.at });
        if (node?.kind !== "CallExpression") return fail("An observation retains its actual checked application.");
        const captured = node.tsonic.observation;
        if (captured.kind !== "available" || captured.value === null) return fail("An observation demand needs the owning Checked capture.");
        const capture = captured.value;
        const selected = resolve({ kind: "body", value: capture.operand }, node.origin);
        if (selected.kind === "refused") return { kind: "done", value: selected };
        let operation: LayoutObservation;
        if (capture.operation === "field-offset") {
          const read = admit(1, 0);
          if (read !== null) return { kind: "done", value: read };
          if (capture.selector === null || capture.field.kind !== "available" || capture.field.value === null)
            return { kind: "done", value: refused(node.origin, "A field offset requires its exact checked field selection.") };
          const field = resolve(capture.field.value, node.origin);
          if (field.kind === "refused") return { kind: "done", value: field };
          if (field.value.source.capture.kind !== "field")
            return { kind: "done", value: refused(node.origin, "A field offset needs its actual field descriptor.") };
          operation = { kind: "field-offset", field: field.value.key };
        } else operation = { kind: capture.operation };
        return { kind: "paused", requests: [selected.value], paused: { demand, capture, operation, origin: node.origin }, earned: [] };
      },
      resume: ({ demand, capture, operation, origin }, answers) => {
        const stopped = admit(1, 1);
        if (stopped !== null) return { kind: "done", value: stopped };
        const answer = answers[0];
        if (answers.length !== 1 || answer === undefined) return fail("An observation needs its one exact prepared layout answer.");
        if (answer.kind === "error")
          return { kind: "done", value: ready({ kind: "error", causes: [{ kind: "unit", unit: answer.unit }] }) };
        const observed = pipelineWiring.metadata.observeLayout(deps, answer.layout, operation, origin);
        return { kind: "done", value: observed.kind === "refused" ? observed : ready({ demand, capture, ...observed.value }) };
      },
    },
    route: row => factRoute(layout, row, answer => answer.kind === "error"
      ? { kind: "error", unit: layoutUnit(row) } : { kind: "ready", layout: answer }),
    witness: (_request, paused) => ({ kind: "constant-demand", origin: paused.origin }),
  });
  let observations: Map<string, PreparedObservationKey> | null = null;
  return {
    deps, observation,
    reached: () => observations?.values() ?? [],
    hasReached: () => observations !== null,
    key: (demand: ObservationDemand): Result<PreparedObservationKey> => {
      const stop = chargeWork(account, demand.instance.body.length) ?? admitArtifactIdentity(demand.instance.bindings, account);
      if (stop !== null) return analysisStop(stop, unit);
      const identity = encodeKey([instanceKey(demand.instance), demand.at.node]);
      const previous = observations?.get(identity);
      if (previous !== undefined) return { kind: "ok", diagnostics: [], value: previous };
      const admission = admit(1, observations === null ? 3 : 2);
      if (admission !== null) return admission;
      const row = { ...demand, identity };
      (observations ??= new Map()).set(identity, row);
      return { kind: "ok", diagnostics: [], value: row };
    },
  };
}
