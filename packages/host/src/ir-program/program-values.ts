import type { DefinitionLocation, InstantiationMeter, InstantiationStop, ProgramLookup } from "./work.js";
import { chargeInstantiationWork, emitInstantiationRecord, reserveInstantiationRecord } from "./work.js";
import { chargeWork } from "../dataflow/index.js";
import { summaryKey } from "../ir-facts/index.js";
import type { InvariantFailure, MessageArgument } from "../diag/contract.js";
import { requirePresent } from "../diag/index.js";
import type { PreparedSyntaxSlot, SyntaxCopyResult } from "../ir-hir/contract.js";
import type { BindingLookup, TypeReferenceRewrite } from "./canonical-types.js";
import type { DefId, ModuleId, SigId, TyId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import { artifactBindingsData, artifactBindingsKey, constantReferenceKey, executionKey, instanceKey } from "../ir-types/index.js";
import type {
  ArtifactBindings, BindingVector, BodyInstance, Execution, ComponentSelector, PointerEvidence, SelfBinding, SumArmRole, SumEvidence,
  TypeBinding, TypeComponent, TypeEvidence, TypeParameter,
} from "../ir-types/contract.js";
import type { HirCallableEndpoint } from "../ir-hir/contract.js";
import type { ProgramRule, SummaryArtifactReference } from "./work-data.js";
import type { BodyRecord, ProgramIndex } from "./data.js";
import type { SummaryKey } from "../ir-facts/contract.js";

export function programChildRule(
  group: "tir-valid" | "mir-valid" | "facts-valid" | "metadata-valid" | "summary-valid" | "dependency-inventory-valid", child: string,
): ProgramRule {
  return child === "cross-owner-qualified" ? "cross-owner-qualified" : group;
}

export function admitBindingVector(meter: InstantiationMeter, distinctCount: number): InstantiationStop | null {
  const limits = meter.limits;
  if (distinctCount >= limits.maximumBindingVectorsPerArtifact) {
    return { kind: "resource-limit", dimension: "binding-vectors", maximum: limits.maximumBindingVectorsPerArtifact };
  }
  return null;
}

export function createBindingLookup(
  meter: InstantiationMeter, bindings: BindingVector,
): { readonly kind: "complete"; readonly lookup: BindingLookup } | InstantiationStop {
  const parameters = new Map<string, TypeBinding>();
  const selves = new Map<DefId, SelfBinding>();
  for (const family of [bindings.classBindings, bindings.methodBindings, bindings.capturedBindings]) {
    for (const binding of family) {
      const stop = chargeInstantiationWork(meter);
      if (stop !== null) return stop;
      const key = binding.parameter;
      if (parameters.has(key)) throw new TypeError("Duplicate requested parameter binding");
      parameters.set(key, binding);
    }
  }
  for (const binding of bindings.selfBindings) {
    const stop = chargeInstantiationWork(meter);
    if (stop !== null) return stop;
    if (selves.has(binding.owner)) throw new TypeError("Duplicate requested self binding");
    selves.set(binding.owner, binding);
  }
  return {
    kind: "complete",
    lookup: {
      parameterBinding: value => parameters.get(value.parameter) ?? value,
      selfBinding: value => selves.get(value.owner) ?? value,
    },
  };
}

export interface ProjectionInventory extends BindingLookup {
  readonly meter: InstantiationMeter;
  readonly componentCycle: (path: string) => never;
  readonly pending: (() => InstantiationStop | null)[];
  readonly types: Set<TyId>;
  readonly signatures: Set<SigId>;
}

export function createProjectionInventory(meter: InstantiationMeter, bindings: BindingLookup,
  componentCycle: (path: string) => never,
): ProjectionInventory {
  return { ...bindings, componentCycle, meter, pending: [], types: new Set(), signatures: new Set() };
}

export function inventoryFields(scan: ProjectionInventory, count: number): InstantiationStop | null {
  for (let position = 0; position < count; position += 1) {
    const stop = chargeInstantiationWork(scan.meter);
    if (stop !== null) return stop;
  }
  return null;
}

export function inventoryRecord(scan: ProjectionInventory, fields: number): InstantiationStop | null {
  return emitInstantiationRecord(scan.meter) ?? inventoryFields(scan, fields);
}

export function inventoryType(scan: ProjectionInventory, value: TyId | null): InstantiationStop | null {
  if (value === null) return null;
  const stop = chargeInstantiationWork(scan.meter);
  if (stop !== null) return stop;
  scan.types.add(value);
  return null;
}

export function inventorySignature(scan: ProjectionInventory, value: SigId): InstantiationStop | null {
  const stop = chargeInstantiationWork(scan.meter);
  if (stop !== null) return stop;
  scan.signatures.add(value);
  return null;
}

export function drainProjectionInventory(scan: ProjectionInventory): InstantiationStop | null {
  let next = scan.pending.pop();
  while (next !== undefined) {
    const stop = next();
    if (stop !== null) return stop;
    next = scan.pending.pop();
  }
  return null;
}

type BindingRowPlan<Value> = PreparedSyntaxSlot<Value, TypeReferenceRewrite>;
export type PreparedReferenceProjection<Value> = SyntaxCopyResult<BindingRowPlan<Value>, InstantiationStop>;
export type ProjectionResult<Value> = SyntaxCopyResult<Value, InstantiationStop>;

export function copiedProjection<Value>(value: Value): ProjectionResult<Value> {
  return { kind: "copied", value };
}

export function finishProjection<Value>(
  scan: ProjectionInventory, prepared: PreparedReferenceProjection<Value>, image: TypeReferenceRewrite,
): ProjectionResult<Value> {
  if (prepared.kind === "refused") return prepared;
  const stop = drainProjectionInventory(scan);
  return stop === null ? { kind: "copied", value: prepared.value(image) } : { kind: "refused", stop };
}

export function projectRecord<Value>(scan: ProjectionInventory, fields: number, build: () => ProjectionResult<Value>):
  ProjectionResult<Value> {
  const stop = inventoryRecord(scan, fields);
  return stop === null ? build() : { kind: "refused", stop };
}

export function projectRead<Value>(scan: ProjectionInventory, build: () => ProjectionResult<Value>): ProjectionResult<Value> {
  const stop = chargeInstantiationWork(scan.meter);
  return stop === null ? build() : { kind: "refused", stop };
}

export function projectRows<Source, Value>(
  scan: ProjectionInventory, source: readonly Source[], project: (read: () => Source, position: number) => ProjectionResult<Value>,
): ProjectionResult<Value[]> {
  return projectRecord(scan, 0, () => {
    const values: Value[] = [];
    const length = source.length;
    for (let position = 0; position < length; position += 1) {
      const ready = project(() => requirePresent(source[position], missingProjection), position);
      if (ready.kind === "refused") return ready;
      values.push(ready.value);
    }
    return { kind: "copied", value: values };
  });
}

export function followingProjection<Source, Value>(
  source: ProjectionResult<Source>, next: (value: Source) => ProjectionResult<Value>,
): ProjectionResult<Value> {
  return source.kind === "refused" ? source : next(source.value);
}

export function orderProjection<Value>(scan: ProjectionInventory, values: Value[], compare: (left: Value, right: Value) => ProjectionResult<number>):
  ProjectionResult<Value[]> {
  return mergeProjection(scan, values, compare, null, false);
}

export interface OrderedTextRecord<Value> {
  readonly value: Value;
  readonly group: string;
  readonly key: string;
}

function compareProjectionText(scan: ProjectionInventory, left: string, right: string): ProjectionResult<number> {
  const stop = chargeWork(scan.meter.account, left.length + right.length);
  return stop === null ? copiedProjection(compareText(left, right)) : { kind: "refused", stop };
}

export function orderTextProjection<Value>(
  scan: ProjectionInventory, values: Value[], keys: (value: Value) => ProjectionResult<OrderedTextRecord<Value>>,
): ProjectionResult<Value[]> {
  if (values.length < 2) return copiedProjection(values);
  let groupsEmpty = true;
  const prepared = projectRows(scan, values, read => projectRecord(scan, 3, () => {
    const keyed = keys(read());
    if (keyed.kind === "copied" && keyed.value.group.length !== 0) groupsEmpty = false;
    return keyed;
  }));
  if (prepared.kind === "refused") return prepared;
  return followingProjection(mergeProjection(scan, prepared.value,
    (left, right) => compareProjectionText(scan, left.key, right.key), value => value.group, groupsEmpty),
  rows => projectRows(scan, rows, read => projectRead(scan, () => copiedProjection(read().value))));
}

function mergeProjection<Value>(
  scan: ProjectionInventory, values: Value[], compare: (left: Value, right: Value) => ProjectionResult<number>,
  groupOf: ((value: Value) => string) | null, groupsEmpty: boolean,
): ProjectionResult<Value[]> {
  if (values.length < 2) return copiedProjection(values);
  return projectRecord(scan, 0, () => {
    let current = values;
    let scratch: Value[] = [];
    let currentSpans: (number | undefined)[] | null = null;
    let scratchSpans: (number | undefined)[] | null = null;
    for (let width = 1; width < current.length; width *= 2) {
      const keepSpans = groupOf !== null && !groupsEmpty && width * 2 < current.length;
      for (let start = 0; start < current.length; start += width * 2) {
        const middle = Math.min(start + width, current.length);
        const end = Math.min(start + width * 2, current.length);
        let left = start;
        let right = middle;
        let leftEnd = groupOf === null || groupsEmpty ? middle : left;
        let rightEnd = groupOf === null || groupsEmpty ? end : right;
        let spanStart = start;
        let previousSpan: number | undefined;
        for (let position = start; position < end; position += 1) {
          const stop = chargeInstantiationWork(scan.meter);
          if (stop !== null) return { kind: "refused", stop };
          let first: Value | undefined;
          let second: Value | undefined;
          if (groupOf !== null && !groupsEmpty && left === leftEnd && right === rightEnd) {
            spanStart = position;
            previousSpan = keepSpans ? scratchSpans?.[spanStart] : undefined;
            leftEnd = left === middle ? left : currentSpans?.[left] ?? left + 1;
            rightEnd = right === end ? right : currentSpans?.[right] ?? right + 1;
            if (left !== leftEnd && right !== rightEnd) {
              first = requirePresent(current[left], missingProjection);
              second = requirePresent(current[right], missingProjection);
              const primary = compareProjectionText(scan, groupOf(first), groupOf(second));
              if (primary.kind === "refused") return primary;
              if (primary.value < 0) rightEnd = right;
              else if (primary.value > 0) leftEnd = left;
            }
          }
          if (left === leftEnd) {
            if (second === undefined) second = requirePresent(current[right], missingProjection);
            scratch[position] = second;
            right += 1;
          } else if (right === rightEnd) {
            if (first === undefined) first = requirePresent(current[left], missingProjection);
            scratch[position] = first;
            left += 1;
          } else {
            if (first === undefined) first = requirePresent(current[left], missingProjection);
            if (second === undefined) second = requirePresent(current[right], missingProjection);
            const comparison = compare(first, second);
            if (comparison.kind === "refused") return comparison;
            if (comparison.value <= 0) {
              scratch[position] = first;
              left += 1;
            } else {
              scratch[position] = second;
              right += 1;
            }
          }
          if (keepSpans && left === leftEnd && right === rightEnd) {
            const spanEnd = position + 1;
            const nonSingleton = spanEnd - spanStart > 1;
            if (nonSingleton || previousSpan !== undefined) {
              const boundary = chargeInstantiationWork(scan.meter);
              if (boundary !== null) return { kind: "refused", stop: boundary };
              if (scratchSpans === null) {
                const allocation = emitInstantiationRecord(scan.meter);
                if (allocation !== null) return { kind: "refused", stop: allocation };
                scratchSpans = [];
              }
              if (previousSpan === undefined) {
                const entry = reserveInstantiationRecord(scan.meter);
                if (entry !== null) return { kind: "refused", stop: entry };
              }
              scratchSpans[spanStart] = nonSingleton ? spanEnd : undefined;
            }
          }
        }
      }
      const previous = current;
      current = scratch;
      scratch = previous;
      const previousSpans: (number | undefined)[] | null = currentSpans;
      currentSpans = scratchSpans;
      scratchSpans = previousSpans;
    }
    return copiedProjection(current);
  });
}

const denseBindings: InvariantFailure = { owner: "ir-program", query: null, origin: null,
  message: "The admitted binding vector must have dense families." };

const missingProjection: InvariantFailure = { owner: "ir-program", query: null, origin: null,
  message: "The actual scoped projection requires every paid reference row." };

export function prepareProjectionRows<Source, Value>(scan: ProjectionInventory, values: readonly Source[],
  prepare: (read: () => Source, index: number) => PreparedReferenceProjection<Value>,
): PreparedSyntaxSlot<Value[], TypeReferenceRewrite> {
  const rows: BindingRowPlan<Value>[] = [];
  const length = values.length;
  let index = 0;
  const next = (): InstantiationStop | null => {
    if (index === length) return null;
    const position = index;
    index += 1;
    scan.pending.push(next);
    const result = prepare(() => requirePresent(values[position], missingProjection), position);
    if (result.kind === "refused") return result.stop;
    rows.push(result.value);
    return null;
  };
  scan.pending.push(next);
  return rewrite => rows.map(row => row(rewrite));
}

export function deferProjection<Value>(scan: ProjectionInventory, prepare: () => PreparedReferenceProjection<Value>): BindingRowPlan<Value> {
  let ready: BindingRowPlan<Value> | undefined;
  scan.pending.push(() => {
    const result = prepare();
    if (result.kind === "refused") return result.stop;
    ready = result.value;
    return null;
  });
  return rewrite => requirePresent(ready, missingProjection)(rewrite);
}

function prepareBindingFamily<Value>(scan: ProjectionInventory, values: readonly Value[],
  row: (value: Value) => SyntaxCopyResult<BindingRowPlan<Value>, InstantiationStop>,
): SyntaxCopyResult<readonly BindingRowPlan<Value>[], InstantiationStop> {
  const plans: BindingRowPlan<Value>[] = [];
  const length = values.length;
  for (let index = 0; index < length; index += 1) {
    const stop = chargeInstantiationWork(scan.meter);
    if (stop !== null) return { kind: "refused", stop };
    const prepared = row(requirePresent(values[index], denseBindings));
    if (prepared.kind === "refused") return prepared;
    plans.push(prepared.value);
  }
  return { kind: "copied", value: plans };
}

function prepareBound<Owner, Value>(scan: ProjectionInventory, readType: () => TyId, readOwner: () => Owner,
  build: (owner: Owner, type: TyId) => Value,
): SyntaxCopyResult<BindingRowPlan<Value>, InstantiationStop> {
  const stop = reserveInstantiationRecord(scan.meter) ?? inventoryFields(scan, 3);
  if (stop !== null) return { kind: "refused", stop };
  const type = readType();
  const typeStop = inventoryType(scan, type);
  if (typeStop !== null) return { kind: "refused", stop: typeStop };
  const owner = readOwner();
  return { kind: "copied", value: rewrite => build(owner, rewrite.type(type)) };
}

function prepareTypeBinding(scan: ProjectionInventory, original: TypeBinding):
  SyntaxCopyResult<BindingRowPlan<TypeBinding>, InstantiationStop> {
  const actual = original.kind === "rigid" ? scan.parameterBinding(original) : original;
  if (actual.kind === "rigid") return { kind: "copied", value: () => actual };
  return prepareBoundType(scan, actual);
}

function prepareBoundType(scan: ProjectionInventory, actual: Extract<TypeBinding, { readonly kind: "bound" }>):
  PreparedReferenceProjection<TypeBinding> {
  return prepareBound(scan, () => actual.type, () => actual.parameter,
    (parameter, type) => ({ kind: "bound", parameter, type }));
}

function prepareSelfBinding(scan: ProjectionInventory, original: SelfBinding):
  SyntaxCopyResult<BindingRowPlan<SelfBinding>, InstantiationStop> {
  const actual = original.kind === "rigid" ? scan.selfBinding(original) : original;
  if (actual.kind === "rigid") return { kind: "copied", value: () => actual };
  return prepareBoundSelf(scan, actual);
}

function prepareBoundSelf(scan: ProjectionInventory, actual: Extract<SelfBinding, { readonly kind: "bound" }>):
  PreparedReferenceProjection<SelfBinding> {
  return prepareBound(scan, () => actual.type, () => actual.owner,
    (owner, type) => ({ kind: "bound", owner, type }));
}

function prepareOwnedRigid<Owner, Value>(scan: ProjectionInventory, readOwner: () => Owner, build: (owner: Owner) => Value):
  PreparedReferenceProjection<Value> {
  const stop = reserveInstantiationRecord(scan.meter) ?? inventoryFields(scan, 2);
  if (stop !== null) return { kind: "refused", stop };
  const owner = readOwner();
  return { kind: "copied", value: () => build(owner) };
}

interface BindingRowRetention {
  readonly parameter: (scan: ProjectionInventory, value: TypeBinding) => PreparedReferenceProjection<TypeBinding>;
  readonly self: (scan: ProjectionInventory, value: SelfBinding) => PreparedReferenceProjection<SelfBinding>;
}

const borrowedBindingRows: BindingRowRetention = { parameter: prepareTypeBinding, self: prepareSelfBinding };
const ownedMirBindingRows: BindingRowRetention = {
  parameter: (scan, value) => value.kind === "bound" ? prepareBoundType(scan, value)
    : prepareOwnedRigid(scan, () => value.parameter, parameter => ({ kind: "rigid", parameter })),
  self: (scan, value) => value.kind === "bound" ? prepareBoundSelf(scan, value)
    : prepareOwnedRigid(scan, () => value.owner, owner => ({ kind: "rigid", owner })),
};

function prepareBindingVector(scan: ProjectionInventory, bindings: BindingVector, retention: BindingRowRetention):
  PreparedReferenceProjection<BindingVector> {
  const header = inventoryRecord(scan, 4);
  if (header !== null) return { kind: "refused", stop: header };
  let ready: BindingRowPlan<BindingVector> | undefined;
  scan.pending.push(() => {
    const prepared = prepareBindingFamilies(scan, bindings, retention);
    if (prepared.kind === "refused") return prepared.stop;
    ready = prepared.value;
    return null;
  });
  return { kind: "copied", value: rewrite => requirePresent(ready, denseBindings)(rewrite) };
}

export function prepareBindingsProjection(scan: ProjectionInventory, bindings: BindingVector): PreparedReferenceProjection<BindingVector> {
  return prepareBindingVector(scan, bindings, borrowedBindingRows);
}

export function prepareMirBindingsProjection(scan: ProjectionInventory, bindings: BindingVector): PreparedReferenceProjection<BindingVector> {
  return prepareBindingVector(scan, bindings, ownedMirBindingRows);
}

function prepareBindingFamilies(scan: ProjectionInventory, bindings: BindingVector, retention: BindingRowRetention):
  PreparedReferenceProjection<BindingVector> {
  const selves = prepareBindingFamily(scan, bindings.selfBindings, row => retention.self(scan, row));
  if (selves.kind === "refused") return selves;
  const captured = prepareBindingFamily(scan, bindings.capturedBindings, row => retention.parameter(scan, row));
  if (captured.kind === "refused") return captured;
  const method = prepareBindingFamily(scan, bindings.methodBindings, row => retention.parameter(scan, row));
  if (method.kind === "refused") return method;
  const classes = prepareBindingFamily(scan, bindings.classBindings, row => retention.parameter(scan, row));
  if (classes.kind === "refused") return classes;
  return { kind: "copied", value: rewrite => ({
      classBindings: classes.value.map(row => row(rewrite)),
      methodBindings: method.value.map(row => row(rewrite)),
      capturedBindings: captured.value.map(row => row(rewrite)),
      selfBindings: selves.value.map(row => row(rewrite)),
  }) };
}

export function prepareArtifactBindings(scan: ProjectionInventory, value: ArtifactBindings): PreparedReferenceProjection<ArtifactBindings> {
  switch (value.kind) {
    case "parametric": {
      const stop = inventoryFields(scan, 1);
      return stop === null ? { kind: "copied", value: () => value } : { kind: "refused", stop };
    }
    case "instantiated": {
      const stop = inventoryRecord(scan, 2);
      if (stop !== null) return { kind: "refused", stop };
      const bindings = prepareBindingsProjection(scan, value.bindings);
      return bindings.kind === "refused" ? bindings : { kind: "copied", value: rewrite => ({
        kind: "instantiated", bindings: bindings.value(rewrite),
      }) };
    }
  }
}

export function prepareInstance(scan: ProjectionInventory, value: BodyInstance,
  selected: ArtifactBindings | null,
): PreparedReferenceProjection<BodyInstance> {
  const stop = inventoryRecord(scan, 2);
  if (stop !== null) return { kind: "refused", stop };
  const bindings = prepareArtifactBindings(scan, value.bindings);
  if (bindings.kind === "refused") return bindings;
  const body = value.body;
  return { kind: "copied", value: rewrite => ({ body, bindings: selected ?? bindings.value(rewrite) }) };
}

export function prepareParameterProjection(scan: ProjectionInventory, read: () => TypeParameter): PreparedReferenceProjection<TypeParameter> {
  const recordStop = inventoryRecord(scan, 4);
  if (recordStop !== null) return { kind: "refused", stop: recordStop };
  const parameter = read();
  const constraint = parameter.constraint;
  const constraintStop = inventoryType(scan, constraint);
  if (constraintStop !== null) return { kind: "refused", stop: constraintStop };
  const fallback = parameter.default;
  const defaultStop = inventoryType(scan, fallback);
  if (defaultStop !== null) return { kind: "refused", stop: defaultStop };
  const declaration = parameter.declaration;
  return { kind: "copied", value: rewrite => ({
    declaration, constraint: constraint === null ? null : rewrite.type(constraint),
    default: fallback === null ? null : rewrite.type(fallback),
  }) };
}

export function prepareEndpoint(scan: ProjectionInventory, read: () => HirCallableEndpoint): PreparedReferenceProjection<HirCallableEndpoint> {
  const record = inventoryRecord(scan, 4);
  if (record !== null) return { kind: "refused", stop: record };
  const value = read();
  const signature = value.signature;
  const stop = inventorySignature(scan, signature);
  if (stop !== null) return { kind: "refused", stop };
  const { declaration, role, body } = value;
  return { kind: "copied", value: rewrite => ({ declaration, role, body, signature: rewrite.signature(signature) }) };
}

interface ComponentPath {
  readonly parent: ComponentPath | null;
  readonly segment: string;
}

const sparseComponent: InvariantFailure = { owner: "ir-program", query: null, origin: null,
  message: "A projected component has a dense accepted source path and role inventory." };

function pathText(path: ComponentPath): string {
  const parts: string[] = [];
  let pending: ComponentPath | null = path;
  while (pending !== null) {
    parts.push(pending.segment);
    pending = pending.parent;
  }
  return parts.reverse().join("");
}

export function prepareComponentProjection(scan: ProjectionInventory, source: TypeComponent, at: string,
  failCycle: (path: string) => never,
): PreparedReferenceProjection<TypeComponent> {
  const initial = inventoryRecord(scan, 2);
  if (initial !== null) return { kind: "refused", stop: initial };
  const changes: ((rewrite: TypeReferenceRewrite) => void)[] = [];
  const pending: (() => InstantiationStop | null)[] = [];
  const active = new Set<TypeComponent>();

  function captureSignature<Value extends ComponentSelector & { signature: SigId }>(fields: number, read: () => SigId,
    copy: (signature: SigId) => Value, retain: (value: ComponentSelector) => void,
  ): InstantiationStop | null {
    const header = inventoryRecord(scan, fields);
    if (header !== null) return header;
    const signature = read();
    const discovered = inventorySignature(scan, signature);
    if (discovered !== null) return discovered;
    const row = copy(signature);
    changes.push(rewrite => { row.signature = rewrite.signature(signature); });
    retain(row);
    return null;
  }

  function captureRoles(read: () => readonly SumArmRole[], target: SumArmRole[]): InstantiationStop | null {
    const roles = read();
    const length = roles.length;
    for (let index = 0; index < length; index += 1) {
      const header = inventoryRecord(scan, 3);
      if (header !== null) return header;
      const source = requirePresent(roles[index], sparseComponent);
      const member = source.member;
      const discovered = inventoryType(scan, member);
      if (discovered !== null) return discovered;
      const captured = { authoredIndex: source.authoredIndex, component: source.component, member };
      changes.push(rewrite => { captured.member = rewrite.type(member); });
      target.push(captured);
    }
    return null;
  }

  function selector(source: ComponentSelector, path: ComponentPath, retain: (value: ComponentSelector) => void): InstantiationStop | null {
    const kind = source.kind;
    switch (kind) {
      case "parameter":
        return captureSignature(3, () => source.signature, (signature): { kind: "parameter"; signature: SigId; index: number } =>
          ({ kind: "parameter", signature, index: source.index }), retain);
      case "receiver":
        return captureSignature(2, () => source.signature, (signature): { kind: "receiver"; signature: SigId } =>
          ({ kind: "receiver", signature }), retain);
      case "result":
        return captureSignature(2, () => source.signature, (signature): { kind: "result"; signature: SigId } =>
          ({ kind: "result", signature }), retain);
      case "signature-tail":
        return captureSignature(4, () => source.signature,
          (signature): { kind: "signature-tail"; signature: SigId; start: number; readonly: boolean } =>
            ({ kind: "signature-tail", signature, start: source.start, readonly: source.readonly }), retain);
      case "index-key":
      case "index-value": {
        const stop = inventoryRecord(scan, 3);
        if (stop !== null) return stop;
        const key = source.key;
        const discovered = inventoryType(scan, key);
        if (discovered !== null) return discovered;
        const result = { kind, origin: source.origin, key };
        changes.push(rewrite => { result.key = rewrite.type(key); });
        retain(result);
        return null;
      }
      case "sum-arm": {
        const stop = inventoryRecord(scan, 3) ?? inventoryRecord(scan, 4);
        if (stop !== null) return stop;
        const family = source.family;
        const nested = family.component;
        const roles: SumArmRole[] = [];
        const index = source.index;
        pending.push(() => captureRoles(() => family.roles, roles));
        pending.push(() => {
          if (active.has(nested)) return failCycle(pathText({ parent: path, segment: ".family.component" }));
          const header = inventoryRecord(scan, 2);
          if (header !== null) return header;
          const component = enter(nested, { parent: path, segment: ".family.component" });
          retain({ kind: "sum-arm", index, family: { origin: family.origin, parameters: family.parameters, roles, component } });
          return null;
        });
        return null;
      }
      case "class-value": case "construction-argument": case "optional-value": case "array-element":
      case "tuple-element": case "union-member": case "argument-place": case "parameter-place":
      case "intersection-member": case "intersection-result": case "argument-tail": case "parameter-tail":
      case "member": case "projection-source": case "tuple-slice": case "type-argument": case "awaited": {
        const stop = inventoryFields(scan, 1);
        if (stop !== null) return stop;
        retain(source);
        return null;
      }
    }
  }

  function enter(current: TypeComponent, location: ComponentPath): TypeComponent {
    active.add(current);
    const input = current.path;
    const length = input.length;
    const output: ComponentSelector[] = [];
    let position = 0;
    const next = (): InstantiationStop | null => {
      if (position === length) {
        active.delete(current);
        return null;
      }
      const stop = chargeInstantiationWork(scan.meter);
      if (stop !== null) return stop;
      const visited = position;
      position += 1;
      const child = requirePresent(input[visited], sparseComponent);
      pending.push(next);
      return selector(child, { parent: location, segment: ".path[" + visited + "]" }, projected => { output[visited] = projected; });
    };
    pending.push(next);
    return { root: current.root, path: output };
  }

  const result = enter(source, { parent: null, segment: at });
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const stop = next();
    if (stop !== null) return { kind: "refused", stop };
  }
  let finish = false;
  return { kind: "copied", value: rewrite => {
    if (finish) throw new TypeError("A prepared component image may only be completed once.");
    for (const change of changes) change(rewrite);
    finish = true;
    return result;
  } };
}

export function deferComponentProjection(scan: ProjectionInventory, read: () => TypeComponent, path: string,
  failCycle: (path: string) => never,
): PreparedSyntaxSlot<TypeComponent, TypeReferenceRewrite> {
  return deferProjection(scan, () => prepareComponentProjection(scan, read(), path, failCycle));
}

function preparePointer(scan: ProjectionInventory, value: PointerEvidence): PreparedReferenceProjection<PointerEvidence> {
  switch (value.kind) {
    case "raw-address":
    case "native-pointer": {
      const stop = inventoryFields(scan, 1);
      return stop === null ? { kind: "copied", value: () => value } : { kind: "refused", stop };
    }
    case "typed-location": {
      const recordStop = inventoryRecord(scan, 3);
      if (recordStop !== null) return { kind: "refused", stop: recordStop };
      const pointee = value.pointee;
      const stop = inventoryType(scan, pointee);
      if (stop !== null) return { kind: "refused", stop };
      const mutability = value.mutability;
      return { kind: "copied", value: rewrite => ({ kind: "typed-location", pointee: rewrite.type(pointee), mutability }) };
    }
    case "function-pointer": {
      const recordStop = inventoryRecord(scan, 5);
      if (recordStop !== null) return { kind: "refused", stop: recordStop };
      const parameters = prepareProjectionRows(scan, value.parameters, read => {
        const stop = chargeInstantiationWork(scan.meter);
        if (stop !== null) return { kind: "refused", stop };
        const type = read();
        scan.types.add(type);
        return { kind: "copied", value: rewrite => rewrite.type(type) };
      });
      const result = value.result;
      const stop = inventoryType(scan, result);
      if (stop !== null) return { kind: "refused", stop };
      const { declaration, abi } = value;
      return { kind: "copied", value: rewrite => ({
        kind: "function-pointer", declaration, parameters: parameters(rewrite), result: rewrite.type(result), abi,
      }) };
    }
  }
}

function prepareSumEvidence(scan: ProjectionInventory, sum: SumEvidence): BindingRowPlan<SumEvidence> {
  const arms = prepareProjectionRows<SumArmRole, SumArmRole>(scan, sum.arms, read => {
    const recordStop = inventoryRecord(scan, 3);
    if (recordStop !== null) return { kind: "refused", stop: recordStop };
    const arm = read();
    const member = arm.member;
    const stop = inventoryType(scan, member);
    if (stop !== null) return { kind: "refused", stop };
    const { authoredIndex, component } = arm;
    return { kind: "copied", value: rewrite => ({ authoredIndex, component, member: rewrite.type(member) }) };
  });
  return deferProjection(scan, () => {
    const recordStop = inventoryRecord(scan, 4);
    if (recordStop !== null) return { kind: "refused", stop: recordStop };
    const bindings = prepareBindingsProjection(scan, sum.bindings);
    if (bindings.kind === "refused") return bindings;
    const { kind, component } = sum;
    return { kind: "copied", value: rewrite => ({
      kind, component, bindings: bindings.value(rewrite), arms: arms(rewrite),
    }) };
  });
}

export function prepareEvidenceProjection(scan: ProjectionInventory, read: () => TypeEvidence): PreparedReferenceProjection<TypeEvidence> {
  const recordStop = inventoryRecord(scan, 7);
  if (recordStop !== null) return { kind: "refused", stop: recordStop };
  const value = read();
  const sum = value.sum;
  const preparedSum = sum === null ? () => null : prepareSumEvidence(scan, sum);
  const pointer = value.pointer;
  const preparedPointer = pointer === null ? () => null : deferProjection(scan, () => preparePointer(scan, pointer));
  const type = value.type;
  const stop = inventoryType(scan, type);
  if (stop !== null) return { kind: "refused", stop };
  const { component, category, numeric, nominal } = value;
  return { kind: "copied", value: rewrite => ({
    type: rewrite.type(type), component, category, numeric, nominal,
    sum: preparedSum(rewrite), pointer: preparedPointer(rewrite),
  }) };
}

export function artifactEnvironmentKey(definition: DefId, bindings: ArtifactBindings): string {
  return encodeKey([definition, artifactBindingsData(bindings)]);
}

export const summaryBindingsOf = (key: SummaryKey): ArtifactBindings => key.kind === "body"
  ? key.execution.instance.bindings : key.execution.request.bindings;

export const summaryReferenceOf = (key: SummaryKey): SummaryArtifactReference => key.kind === "body"
  ? { kind: "summary", target: "body", body: key.execution.instance.body, provided: key.execution.provided }
  : { kind: "summary", target: "declared", definition: key.execution.request.definition,
      endpoint: key.execution.request.endpoint, ordinal: key.execution.request.ordinal, provided: key.execution.provided };

export const summaryReferenceKey = (reference: SummaryArtifactReference): string => encodeKey(reference.target === "body"
  ? [reference.target, reference.body, reference.provided]
  : [reference.target, reference.definition, reference.endpoint, reference.ordinal, reference.provided]);

export function uniqueRows<Identity, Value>(
  rows: readonly Value[],
  identityOf: (row: Value) => Identity,
): ReadonlyMap<Identity, Value | null> {
  const result = new Map<Identity, Value | null>();
  for (const row of rows) {
    const identity = identityOf(row);
    result.set(identity, result.has(identity) ? null : row);
  }
  return result;
}

export function programLookup(index: ProgramIndex): ProgramLookup {
  const definitions: DefinitionLocation[] = [];
  for (const module of index.modules) {
    for (const entry of module.items) definitions.push({ module: module.module, entry });
  }
  const bodiesByModule = new Map<ModuleId, BodyRecord[]>();
  for (const record of index.bodies) {
    const previous = bodiesByModule.get(record.module);
    if (previous === undefined) bodiesByModule.set(record.module, [record]);
    else previous.push(record);
  }
  const executionsByInstance = new Map<string, Execution[]>();
  const executions = new Map<string, Execution | null>();
  for (const operation of index.dependencyInventory.operations) {
    if (operation.kind !== "body") continue;
    const execution = operation.execution;
    const selected = executionKey(execution);
    executions.set(selected, executions.has(selected) ? null : execution);
    const key = instanceKey(execution.instance);
    const previous = executionsByInstance.get(key);
    if (previous === undefined) executionsByInstance.set(key, [execution]);
    else previous.push(execution);
  }
  return {
    packages: uniqueRows(index.packages, record => record.id),
    modules: uniqueRows(index.modules, record => record.module),
    definitions: uniqueRows(definitions, location => location.entry.definition),
    bodiesByModule,
    instances: uniqueRows(index.bodies, record => instanceKey(record.instance)),
    executions,
    executionsByInstance,
    metadata: uniqueRows(index.metadata, record => artifactEnvironmentKey(record.key.definition, record.key.bindings)),
    summaries: uniqueRows(index.summaries, record => summaryKey(record.key)),
    constants: uniqueRows(index.constants, record => constantReferenceKey(record.reference)),
  };
}

export function textDetail(value: string): MessageArgument {
  return { kind: "text", value };
}

export function numberDetail(value: number): MessageArgument {
  return { kind: "number", value };
}

export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareInstances(left: BodyInstance, right: BodyInstance): number {
  return compareText(left.body, right.body)
    || compareText(artifactBindingsKey(left.bindings), artifactBindingsKey(right.bindings));
}

export function compareExecutions(left: Execution, right: Execution): number {
  return compareInstances(left.instance, right.instance) || left.provided - right.provided;
}
