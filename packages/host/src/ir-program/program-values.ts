import type { MessageArgument, Violation } from "../diag/contract.js";
import type { BodyId, DefId, KeyData, ModuleId, PackageId, SigId, TyId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type {
  ArtifactBindings, BindingVector, BodyInstance, ComponentSelector, PointerEvidence, SelfBinding, TypeBinding,
  TypeComponent, TypeEvidence, TypeParameter, TypeParameterIdentity,
} from "../ir-types/contract.js";
import type { HirCallableEndpoint } from "../ir-hir/contract.js";
import type { BodyRecord, ConstantRecord, DefinitionNode, InstantiationLimits, ModuleRecord, PackageRecord, ProgramIndex, ProgramRule, ProgramSite } from "./contract.js";
import type { MetadataRecord, Summary } from "../ir-facts/contract.js";

export interface DefinitionLocation {
  readonly module: ModuleId;
  readonly entry: DefinitionNode;
}

export interface ProgramLookup {
  readonly packages: ReadonlyMap<PackageId, PackageRecord | null>;
  readonly modules: ReadonlyMap<ModuleId, ModuleRecord | null>;
  readonly definitions: ReadonlyMap<DefId, DefinitionLocation | null>;
  readonly bodies: ReadonlyMap<BodyId, readonly BodyRecord[]>;
  readonly instances: ReadonlyMap<string, BodyRecord | null>;
  readonly metadata: ReadonlyMap<string, MetadataRecord | null>;
  readonly summaries: ReadonlyMap<string, Summary | null>;
  readonly constants: ReadonlyMap<string, ConstantRecord | null>;
}

export type ProgramViolation = Violation<ProgramRule, ProgramSite>;

export function programChildRule(
  group: "tir-valid" | "mir-valid" | "facts-valid" | "metadata-valid" | "summary-valid", child: string,
): ProgramRule {
  return child === "cross-owner-qualified" ? "cross-owner-qualified" : group;
}

export interface InstantiationMeter {
  readonly limits: InstantiationLimits;
  work: number;
  created: number;
}

export type InstantiationStop = {
  readonly kind: "resource-limit";
  readonly dimension: "work" | "created-records" | "binding-vectors";
  readonly maximum: number;
};

export function createInstantiationMeter(limits: InstantiationLimits): InstantiationMeter {
  requireInstantiationMaximum(limits.maximumWork, "maximumWork");
  requireInstantiationMaximum(limits.maximumCreatedRecords, "maximumCreatedRecords");
  requireInstantiationMaximum(limits.maximumBindingVectorsPerArtifact, "maximumBindingVectorsPerArtifact");
  return { limits, work: 0, created: 0 };
}

export function chargeInstantiationWork(meter: InstantiationMeter): InstantiationStop | null {
  if (meter.work >= meter.limits.maximumWork) {
    return { kind: "resource-limit", dimension: "work", maximum: meter.limits.maximumWork };
  }
  meter.work += 1;
  return null;
}

export function emitInstantiationRecord(meter: InstantiationMeter): InstantiationStop | null {
  const work = chargeInstantiationWork(meter);
  if (work !== null) return work;
  if (meter.created >= meter.limits.maximumCreatedRecords) {
    return { kind: "resource-limit", dimension: "created-records", maximum: meter.limits.maximumCreatedRecords };
  }
  meter.created += 1;
  return null;
}

export function admitBindingVector(meter: InstantiationMeter, distinctCount: number): InstantiationStop | null {
  if (distinctCount >= meter.limits.maximumBindingVectorsPerArtifact) {
    return { kind: "resource-limit", dimension: "binding-vectors", maximum: meter.limits.maximumBindingVectorsPerArtifact };
  }
  return null;
}

export interface BindingLookup {
  readonly parameterBinding: (value: { readonly kind: "rigid"; readonly parameter: TypeParameterIdentity }) => TypeBinding;
  readonly selfBinding: (value: { readonly kind: "rigid"; readonly owner: DefId }) => SelfBinding;
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
      const key = encodeKey([binding.parameter.owner, binding.parameter.index]);
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
      parameterBinding: value => parameters.get(encodeKey([value.parameter.owner, value.parameter.index])) ?? value,
      selfBinding: value => selves.get(value.owner) ?? value,
    },
  };
}

export interface ProjectionInventory extends BindingLookup {
  readonly meter: InstantiationMeter;
  readonly pending: (() => InstantiationStop | null)[];
  readonly types: Set<TyId>;
  readonly signatures: Set<SigId>;
  readonly components: Set<TypeComponent>;
}

export function createProjectionInventory(meter: InstantiationMeter, bindings: BindingLookup): ProjectionInventory {
  return { ...bindings, meter, pending: [], types: new Set(), signatures: new Set(), components: new Set() };
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

export function inventoryEach<Value>(
  scan: ProjectionInventory, values: readonly Value[], visit: (value: Value) => InstantiationStop | null,
): void {
  const iterator = values.values();
  const next = (): InstantiationStop | null => {
    const entry = iterator.next();
    if (entry.done) return null;
    scan.pending.push(next);
    return visit(entry.value);
  };
  scan.pending.push(next);
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

export function inventoryBindings(scan: ProjectionInventory, value: BindingVector): InstantiationStop | null {
  for (const family of [value.classBindings, value.methodBindings, value.capturedBindings]) {
    inventoryEach(scan, family, original => {
      const binding = original.kind === "rigid" ? scan.parameterBinding(original) : original;
      switch (binding.kind) {
        case "rigid": return inventoryFields(scan, 1);
        case "bound": return inventoryRecord(scan, 3) ?? inventoryType(scan, binding.type);
      }
    });
  }
  inventoryEach(scan, value.selfBindings, original => {
    const binding = original.kind === "rigid" ? scan.selfBinding(original) : original;
    switch (binding.kind) {
      case "rigid": return inventoryFields(scan, 1);
      case "bound": return inventoryRecord(scan, 3) ?? inventoryType(scan, binding.type);
    }
  });
  return inventoryRecord(scan, 4);
}

export function inventoryArtifactBindings(scan: ProjectionInventory, value: ArtifactBindings): InstantiationStop | null {
  switch (value.kind) {
    case "parametric": return inventoryFields(scan, 1);
    case "instantiated": return inventoryRecord(scan, 2) ?? inventoryBindings(scan, value.bindings);
  }
}

export function inventoryInstance(scan: ProjectionInventory, value: BodyInstance): InstantiationStop | null {
  return inventoryRecord(scan, 2) ?? inventoryArtifactBindings(scan, value.bindings);
}

export function inventoryParameter(scan: ProjectionInventory, value: TypeParameter): InstantiationStop | null {
  return inventoryRecord(scan, 4) ?? inventoryType(scan, value.constraint) ?? inventoryType(scan, value.default);
}

export function inventoryEndpoint(scan: ProjectionInventory, value: HirCallableEndpoint): InstantiationStop | null {
  return inventoryRecord(scan, 4) ?? inventorySignature(scan, value.signature);
}

function inventorySelector(scan: ProjectionInventory, value: ComponentSelector): InstantiationStop | null {
  const step = chargeInstantiationWork(scan.meter);
  if (step !== null) return step;
  switch (value.kind) {
    case "parameter": return inventoryRecord(scan, 3) ?? inventorySignature(scan, value.signature);
    case "receiver":
    case "result": return inventoryRecord(scan, 2) ?? inventorySignature(scan, value.signature);
    case "signature-tail": return inventoryRecord(scan, 4) ?? inventorySignature(scan, value.signature);
    case "sum-arm": {
      inventoryEach(scan, value.family.roles, role => inventoryRecord(scan, 3) ?? inventoryType(scan, role.member));
      scan.pending.push(() => inventoryComponent(scan, value.family.component));
      return inventoryRecord(scan, 3) ?? inventoryRecord(scan, 4);
    }
    case "class-value":
    case "construction-argument":
    case "optional-value":
    case "array-element":
    case "tuple-element":
    case "union-member":
    case "argument-place":
    case "parameter-place":
    case "intersection-member":
    case "intersection-result":
    case "argument-tail":
    case "parameter-tail":
    case "member":
    case "index-key":
    case "index-value":
    case "projection-source":
    case "tuple-slice":
    case "type-argument":
    case "awaited": return inventoryFields(scan, 1);
  }
}

export function inventoryComponent(scan: ProjectionInventory, value: TypeComponent): InstantiationStop | null {
  scan.pending.push(() => {
    if (scan.components.has(value)) throw new TypeError("Inline cycle in instantiation TypeComponent");
    scan.components.add(value);
    scan.pending.push(() => { scan.components.delete(value); return null; });
    inventoryEach(scan, value.path, selector => inventorySelector(scan, selector));
    return inventoryRecord(scan, 2);
  });
  return null;
}

function inventoryPointer(scan: ProjectionInventory, value: PointerEvidence): InstantiationStop | null {
  switch (value.kind) {
    case "raw-address":
    case "native-pointer": return inventoryFields(scan, 1);
    case "typed-location": return inventoryRecord(scan, 3) ?? inventoryType(scan, value.pointee);
    case "function-pointer":
      inventoryEach(scan, value.parameters, type => inventoryType(scan, type));
      return inventoryRecord(scan, 5) ?? inventoryType(scan, value.result);
  }
}

export function inventoryEvidence(scan: ProjectionInventory, value: TypeEvidence): InstantiationStop | null {
  if (value.sum !== null) {
    const sum = value.sum;
    inventoryEach(scan, sum.arms, arm => inventoryRecord(scan, 3) ?? inventoryType(scan, arm.member));
    scan.pending.push(() => inventoryRecord(scan, 4) ?? inventoryBindings(scan, sum.bindings));
  }
  if (value.pointer !== null) {
    const pointer = value.pointer;
    scan.pending.push(() => inventoryPointer(scan, pointer));
  }
  return inventoryRecord(scan, 7) ?? inventoryType(scan, value.type);
}

export function requireInstantiationMaximum(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`Invalid InstantiationLimits.${name}`);
  }
}

function typeBindingData(binding: TypeBinding): KeyData {
  switch (binding.kind) {
    case "rigid": return ["rigid", binding.parameter.owner, binding.parameter.index];
    case "bound": return ["bound", binding.parameter.owner, binding.parameter.index, binding.type];
  }
}

function selfBindingData(binding: SelfBinding): KeyData {
  switch (binding.kind) {
    case "rigid": return ["rigid", binding.owner];
    case "bound": return ["bound", binding.owner, binding.type];
  }
}

export function bindingData(bindings: BindingVector): KeyData {
  return [
    bindings.classBindings.map(typeBindingData),
    bindings.methodBindings.map(typeBindingData),
    bindings.capturedBindings.map(typeBindingData),
    bindings.selfBindings.map(selfBindingData),
  ];
}

export function artifactBindingData(bindings: ArtifactBindings): KeyData {
  switch (bindings.kind) {
    case "parametric": return ["parametric"];
    case "instantiated": return ["instantiated", bindingData(bindings.bindings)];
  }
}

export function instanceKey(instance: BodyInstance): string {
  return encodeKey([instance.body, artifactBindingData(instance.bindings)]);
}

export function artifactEnvironmentKey(definition: DefId, bindings: ArtifactBindings): string {
  return encodeKey([definition, artifactBindingData(bindings)]);
}

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
  const bodies = new Map<BodyId, BodyRecord[]>();
  for (const record of index.bodies) {
    const previous = bodies.get(record.instance.body);
    if (previous === undefined) bodies.set(record.instance.body, [record]);
    else previous.push(record);
  }
  return {
    packages: uniqueRows(index.packages, record => record.id),
    modules: uniqueRows(index.modules, record => record.module),
    definitions: uniqueRows(definitions, location => location.entry.definition),
    bodies,
    instances: uniqueRows(index.bodies, record => instanceKey(record.instance)),
    metadata: uniqueRows(index.metadata, record => artifactEnvironmentKey(record.key.definition, record.key.bindings)),
    summaries: uniqueRows(index.summaries, record => artifactEnvironmentKey(record.key.definition, record.key.bindings)),
    constants: uniqueRows(index.constants, record => instanceKey(record.initializer)),
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
    || compareText(encodeKey(artifactBindingData(left.bindings)), encodeKey(artifactBindingData(right.bindings)));
}
