import type { KeyData } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { ArtifactBindings, BindingVector, BodyInstance, Execution, SelfBinding, TypeBinding } from "./data.js";
import type { DeclaredExecution } from "./contract.js";
export { tyId as typeIdentifier, sigId as signatureIdentifier } from "../ids/index.js";

// The binding-vector projection of W2's K-1 key (ir-tir verify-instances bindingVectorData), stated here at the owner of
// the binding records so that every reader can name it: every position of the four families on its own, a hole as
// null at its position. Two vectors that differ at any position, or in which positions hold a binding, have different
// keys; equal vectors have equal keys. ir-tir and ir-facts keep their private copies until W2 replaces them with this one.
const typeBindingData = (binding: TypeBinding | undefined): KeyData => binding === undefined ? null : binding.kind === "rigid"
  ? [binding.kind, binding.parameter.owner, binding.parameter.index]
  : [binding.kind, binding.parameter.owner, binding.parameter.index, binding.type];

const selfBindingData = (binding: SelfBinding | undefined): KeyData => binding === undefined ? null : binding.kind === "rigid"
  ? [binding.kind, binding.owner] : [binding.kind, binding.owner, binding.type];

export const bindingVectorData = (vector: BindingVector): KeyData => [Array.from(vector.classBindings, typeBindingData),
  Array.from(vector.methodBindings, typeBindingData), Array.from(vector.capturedBindings, typeBindingData), Array.from(vector.selfBindings, selfBindingData)];

const artifactBindingsData = (bindings: ArtifactBindings): KeyData =>
  bindings.kind === "parametric" ? [bindings.kind] : [bindings.kind, bindingVectorData(bindings.bindings)];

const instanceData = (instance: BodyInstance): KeyData => [instance.body, artifactBindingsData(instance.bindings)];

export const instanceKeyOf = (instance: BodyInstance): string => encodeKey(instanceData(instance));

export const sameInstanceAs = (left: BodyInstance, right: BodyInstance): boolean => instanceKeyOf(left) === instanceKeyOf(right);

export const executionKeyOf = (execution: Execution): string => encodeKey(["execution", instanceData(execution.instance), execution.provided]);

export const declaredExecutionKeyOf = (execution: DeclaredExecution): string => {
  const request = execution.request;
  return encodeKey(["declared-execution", request.definition, request.endpoint, request.ordinal, artifactBindingsData(request.bindings),
    execution.provided]);
};

export function required<Key, Value>(values: ReadonlyMap<Key, Value>, key: Key): Value {
  const value = values.get(key);
  if (value === undefined) throw new Error("Canonical publication requires a complete arena reference.");
  return value;
}

export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
