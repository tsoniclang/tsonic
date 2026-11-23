import type { DefId, KeyData, TyId } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { ArtifactBindings, BindingVector, BodyInstance, ConstantReference, Execution, SelfBinding, TypeBinding } from "./data.js";
import type { DeclaredExecution, ReadBindingVectorKey, RigidBindings, SignatureRequest, TypeTableAdmissionStop } from "./contract.js";
import type { IndexInventoryEntry, MemberKey, MemberOrigin, MemberStorageSelection } from "./data.js";
export { tyId as typeIdentifier, sigId as signatureIdentifier } from "../ids/index.js";

type BindingRow = readonly ["rigid", DefId] | readonly ["bound", DefId, TyId] | null;
export type BindingReader = (family: keyof BindingVector, row: BindingRow) => void;

function typeBindingData(binding: TypeBinding | undefined): BindingRow {
  if (binding === undefined) return null;
  const { kind, parameter } = binding;
  return kind === "rigid" ? [kind, parameter] : [kind, parameter, binding.type];
}

function selfBindingData(binding: SelfBinding | undefined): BindingRow {
  if (binding === undefined) return null;
  const { kind, owner } = binding;
  return kind === "rigid" ? [kind, owner] : [kind, owner, binding.type];
}

function readBindingFamily<Row, Stop extends TypeTableAdmissionStop>(rows: readonly Row[], project: (row: Row | undefined) => BindingRow,
  family: keyof BindingVector, admitRow: () => Stop | null, read: BindingReader): Stop | null {
  for (let position = 0; position < rows.length; position += 1) {
    const stop = admitRow();
    if (stop !== null) return stop;
    read(family, project(rows[position]));
  }
  return null;
}

export function readBindingRows<Stop extends TypeTableAdmissionStop>(vector: BindingVector, admitRow: () => Stop | null,
  read: BindingReader): Stop | null {
  return readBindingFamily(vector.classBindings, typeBindingData, "classBindings", admitRow, read) ??
    readBindingFamily(vector.methodBindings, typeBindingData, "methodBindings", admitRow, read) ??
    readBindingFamily(vector.capturedBindings, typeBindingData, "capturedBindings", admitRow, read) ??
    readBindingFamily(vector.selfBindings, selfBindingData, "selfBindings", admitRow, read);
}

function projectBindingVector<Stop extends TypeTableAdmissionStop>(vector: BindingVector, admitRow: () => Stop | null,
  read: BindingReader | null): readonly BindingRow[][] | Stop {
  const classBindings: BindingRow[] = [], methodBindings: BindingRow[] = [], capturedBindings: BindingRow[] = [], selfBindings: BindingRow[] = [];
  const rows = { classBindings, methodBindings, capturedBindings, selfBindings };
  const stop = readBindingRows(vector, admitRow, (family, row) => {
    read?.(family, row);
    rows[family].push(row);
  });
  return stop ?? [classBindings, methodBindings, capturedBindings, selfBindings];
}

export const bindingVectorData = (vector: BindingVector): KeyData => projectBindingVector<never>(vector, () => null, null);

export function readBindingKey<Stop extends TypeTableAdmissionStop>(vector: BindingVector, admitRow: () => Stop | null,
  read: BindingReader | null): { readonly kind: "complete"; readonly key: string } | Stop {
  const result = projectBindingVector(vector, admitRow, read);
  return "kind" in result ? result : { kind: "complete", key: encodeKey(result) };
}

export const readBindingVectorKey: ReadBindingVectorKey = (vector, admitRow) => readBindingKey(vector, admitRow, null);

export const artifactBindingsData = (bindings: ArtifactBindings): KeyData =>
  bindings.kind === "parametric" ? [bindings.kind] : [bindings.kind, bindingVectorData(bindings.bindings)];

export const bindingVectorKeyOf = (vector: BindingVector): string => encodeKey(bindingVectorData(vector));

export const artifactBindingsKeyOf = (bindings: ArtifactBindings): string => encodeKey(artifactBindingsData(bindings));

export const rigidBindings: RigidBindings = scope => ({
  classBindings: scope.classParameters.map(parameter => ({ kind: "rigid", parameter })),
  methodBindings: scope.methodParameters.map(parameter => ({ kind: "rigid", parameter })),
  capturedBindings: scope.capturedParameters.map(parameter => ({ kind: "rigid", parameter })),
  selfBindings: scope.selfOwners.map(owner => ({ kind: "rigid", owner })),
});

export const signatureRequestData = (request: SignatureRequest): readonly KeyData[] =>
  [request.definition, request.endpoint, request.ordinal, artifactBindingsData(request.bindings)];

export const signatureRequestKeyOf = (request: SignatureRequest): string => encodeKey(signatureRequestData(request));

const instanceData = (instance: BodyInstance): KeyData => [instance.body, artifactBindingsData(instance.bindings)];

export const instanceKeyOf = (instance: BodyInstance): string => encodeKey(instanceData(instance));
export const constantReferenceKeyOf = (reference: ConstantReference): string => reference.context === "enum-member"
  ? encodeKey([reference.context, reference.member, artifactBindingsData(reference.bindings)])
  : encodeKey([instanceData(reference.initializer), reference.context]);

export const sameInstanceAs = (left: BodyInstance, right: BodyInstance): boolean => instanceKeyOf(left) === instanceKeyOf(right);

export const executionKeyOf = (execution: Execution): string => encodeKey(["execution", instanceData(execution.instance), execution.provided]);

export const declaredExecutionKeyOf = (execution: DeclaredExecution): string => {
  return encodeKey(["declared-execution", ...signatureRequestData(execution.request), execution.provided]);
};

function memberKeyData(key: MemberKey): KeyData {
  switch (key.kind) {
    case "text": return [key.kind, key.value];
    case "number": return [key.kind, key.value.numerator, key.value.denominator, key.value.negativeZero];
    case "symbol": return [key.kind, key.declaration];
  }
}

function memberOriginData(origin: MemberOrigin): KeyData {
  switch (origin.kind) {
    case "declared": return [origin.kind, origin.declaration];
    case "class-prototype": return [origin.kind, origin.owner];
    case "intrinsic": return [origin.kind, origin.symbol];
    case "source-member": return [origin.kind, origin.occurrence.body, origin.occurrence.node];
    case "mapped": return [origin.kind, origin.owner.kind,
      origin.owner.kind === "body" ? origin.owner.value.body : origin.owner.value.owner,
      origin.owner.value.node, memberKeyData(origin.key)];
  }
}

export function memberStorageData(member: MemberStorageSelection): KeyData {
  return [memberKeyData(member.key), Array.from(member.origins, origin => origin === undefined ? null : memberOriginData(origin)),
    Array.from(member.selectedDeclarations, declaration => declaration === undefined ? null : declaration),
    member.primary, bindingVectorData(member.bindings)];
}

export function required<Key, Value>(values: ReadonlyMap<Key, Value>, key: Key): Value {
  const value = values.get(key);
  if (value === undefined) throw new Error("Canonical publication requires a complete arena reference.");
  return value;
}

export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareIndexSignatures(left: IndexInventoryEntry, right: IndexInventoryEntry): number {
  const first = left.origin;
  const second = right.origin;
  return compareText(first.kind, second.kind)
    || compareText(first.kind === "body" ? first.value.body : first.value.owner,
      second.kind === "body" ? second.value.body : second.value.owner)
    || first.value.node - second.value.node || left.key - right.key;
}
