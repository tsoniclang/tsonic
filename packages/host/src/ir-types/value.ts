import type { KeyData } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { ArtifactBindings, BindingVector, BodyInstance, ConstantReference, Execution, SelfBinding, TypeBinding } from "./data.js";
import type { DeclaredExecution, RigidBindings, SignatureRequest } from "./contract.js";
import type { MemberKey, MemberOrigin, MemberStorageSelection } from "./data.js";
export { tyId as typeIdentifier, sigId as signatureIdentifier } from "../ids/index.js";

const typeBindingData = (binding: TypeBinding | undefined): KeyData => binding === undefined ? null : binding.kind === "rigid"
  ? [binding.kind, binding.parameter.owner, binding.parameter.index]
  : [binding.kind, binding.parameter.owner, binding.parameter.index, binding.type];

const selfBindingData = (binding: SelfBinding | undefined): KeyData => binding === undefined ? null : binding.kind === "rigid"
  ? [binding.kind, binding.owner] : [binding.kind, binding.owner, binding.type];

export const bindingVectorData = (vector: BindingVector): KeyData => [Array.from(vector.classBindings, typeBindingData),
  Array.from(vector.methodBindings, typeBindingData), Array.from(vector.capturedBindings, typeBindingData), Array.from(vector.selfBindings, selfBindingData)];

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
export const constantReferenceKeyOf = (reference: ConstantReference): string => encodeKey([instanceData(reference.initializer), reference.context]);

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
