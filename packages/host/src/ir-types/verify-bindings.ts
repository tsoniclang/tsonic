import type { MessageArgument, Violation } from "../diag/contract.js";
import type { BindingVerificationInput, ProjectBindingScope, TypeBinding, TypeRule, TypeSite, VerifyBindings } from "./contract.js";
import type { DefId } from "../ids/contract.js";

type BindingStep = { readonly kind: "work"; readonly units: number }
  | { readonly kind: "violation"; readonly violation: Violation<TypeRule, TypeSite> };

type ScopeResult<Value, Stop> = { readonly kind: "complete"; readonly value: Value | null }
  | { readonly kind: "resource-stop"; readonly stop: Stop };
const emptyBindings: readonly [] = [];

function selectScopeBindings<Value, Stop extends object>(source: readonly Value[], required: readonly DefId[],
  ownerOf: (binding: Value) => DefId, admit: (work: number, entries: number) => Stop | null): ScopeResult<readonly Value[], Stop> {
  if (required.length > source.length) return { kind: "complete", value: null };
  if (required.length === 0) return { kind: "complete", value: source.length === 0 ? source : emptyBindings };
  const needsCopy = source.length !== required.length;
  const reserve = needsCopy ? admit(0, 1 + required.length) : null;
  if (reserve !== null) return { kind: "resource-stop", stop: reserve };
  const result: Value[] | null = needsCopy ? [] : null;
  let position = 0;
  for (let index = 0; index < required.length; index += 1) {
    const next = admit(1, 0);
    if (next !== null) return { kind: "resource-stop", stop: next };
    const key = required[index];
    if (key === undefined) return { kind: "complete", value: null };
    let found = false;
    while (position < source.length) {
      const paid = admit(1, 0);
      if (paid !== null) return { kind: "resource-stop", stop: paid };
      const candidate = source[position];
      position += 1;
      if (candidate === undefined) return { kind: "complete", value: null };
      const owner = ownerOf(candidate);
      const comparison = admit(key.length + owner.length, 0);
      if (comparison !== null) return { kind: "resource-stop", stop: comparison };
      if (key !== owner) continue;
      result?.push(candidate);
      found = true;
      break;
    }
    if (!found) return { kind: "complete", value: null };
  }
  return { kind: "complete", value: result ?? source };
}

export const projectBindingScope: ProjectBindingScope = (vector, scope, admit) => {
  const prior = admit(0, 0);
  if (prior !== null) return { kind: "resource-stop", stop: prior };
  const classBindings = vector.classBindings;
  const classes = selectScopeBindings(classBindings, scope.classParameters, binding => binding.parameter, admit);
  if (classes.kind !== "complete") return classes;
  if (classes.value === null) return { kind: "complete", value: null };
  const methodBindings = vector.methodBindings;
  const methods = selectScopeBindings(methodBindings, scope.methodParameters, binding => binding.parameter, admit);
  if (methods.kind !== "complete") return methods;
  if (methods.value === null) return { kind: "complete", value: null };
  const capturedBindings = vector.capturedBindings;
  const captured = selectScopeBindings(capturedBindings, scope.capturedParameters, binding => binding.parameter, admit);
  if (captured.kind !== "complete") return captured;
  if (captured.value === null) return { kind: "complete", value: null };
  const selfBindings = vector.selfBindings;
  const self = selectScopeBindings(selfBindings, scope.selfOwners, binding => binding.owner, admit);
  if (self.kind !== "complete") return self;
  if (self.value === null) return { kind: "complete", value: null };
  if (classes.value === classBindings && methods.value === methodBindings && captured.value === capturedBindings
    && self.value === selfBindings) return { kind: "complete", value: vector };
  const retained = admit(0, 1);
  return retained !== null ? { kind: "resource-stop", stop: retained }
    : { kind: "complete", value: { classBindings: classes.value, methodBindings: methods.value,
      capturedBindings: captured.value, selfBindings: self.value } };
};

function finding(rule: TypeRule, site: TypeSite, field: string, value: number | null = null): BindingStep {
  const detail: MessageArgument[] = [{ kind: "text", value: field }];
  if (value !== null) detail.push({ kind: "number", value });
  return { kind: "violation", violation: { rule, site, detail } };
}

function validReference(value: number, length: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0) && value < length;
}

export function* bindingChecks(bindings: readonly BindingVerificationInput[], typeCount: number): Generator<BindingStep, void> {
  for (let vectorIndex = 0; vectorIndex < bindings.length; vectorIndex += 1) {
    yield { kind: "work", units: 1 };
    const entry = bindings[vectorIndex];
    if (entry === undefined) {
      yield finding("binding-vector-complete", { kind: "binding", vector: vectorIndex, family: null, position: null }, "bindings", vectorIndex);
      continue;
    }
    const { vector, scope } = entry;
    const families: readonly (readonly ["classBindings" | "methodBindings" | "capturedBindings", readonly TypeBinding[], readonly DefId[]])[] = [
      ["classBindings", vector.classBindings, scope.classParameters], ["methodBindings", vector.methodBindings, scope.methodParameters],
      ["capturedBindings", vector.capturedBindings, scope.capturedParameters],
    ];
    for (const [family, actual, expected] of families) {
      yield { kind: "work", units: 1 };
      if (actual.length !== expected.length)
        yield finding("binding-vector-complete", { kind: "binding", vector: vectorIndex, family, position: null }, "length", actual.length);
      for (let position = 0; position < actual.length; position += 1) {
        yield { kind: "work", units: 1 };
        const site: TypeSite = { kind: "binding", vector: vectorIndex, family, position };
        const binding = actual[position];
        const selected = expected[position];
        if (binding === undefined) { yield finding("binding-vector-complete", site, "entry"); continue; }
        if (position < expected.length) {
          if (selected !== undefined) yield { kind: "work", units: binding.parameter.length + selected.length };
          if (selected === undefined || binding.parameter !== selected)
            yield finding("binding-vector-complete", site, "parameter");
        }
        if (binding.kind === "bound" && !validReference(binding.type, typeCount))
          yield finding("type-reference", site, "type", binding.type);
      }
    }
    const family = "selfBindings";
    yield { kind: "work", units: 1 };
    if (vector.selfBindings.length !== scope.selfOwners.length)
      yield finding("binding-vector-complete", { kind: "binding", vector: vectorIndex, family, position: null }, "length", vector.selfBindings.length);
    const owners = new Set<string>();
    for (const owner of scope.selfOwners) {
      if (owner === undefined) { yield { kind: "work", units: 1 }; continue; }
      yield { kind: "work", units: 1 + owner.length };
      owners.add(owner);
    }
    const seen = new Set<string>();
    for (let position = 0; position < vector.selfBindings.length; position += 1) {
      yield { kind: "work", units: 1 };
      const site: TypeSite = { kind: "binding", vector: vectorIndex, family, position };
      const binding = vector.selfBindings[position];
      if (binding === undefined) { yield finding("binding-vector-complete", site, "entry"); continue; }
      const selected = scope.selfOwners[position];
      yield { kind: "work", units: binding.owner.length + (selected?.length ?? 0) };
      if (!owners.has(binding.owner) || seen.has(binding.owner)) yield finding("self-owner", site, "owner");
      if (selected !== undefined && binding.owner !== selected) yield finding("self-binding-order", site, "owner");
      if (binding.kind === "bound" && !validReference(binding.type, typeCount)) yield finding("type-reference", site, "type", binding.type);
      seen.add(binding.owner);
    }
  }
}

export const verifyBindings: VerifyBindings = (bindings, typeCount, admit) => {
  if (!Number.isSafeInteger(typeCount) || typeCount < 0 || Object.is(typeCount, -0))
    throw new TypeError("Binding verification requires the actual published type domain");
  const initial = admit(1, 1);
  if (initial !== null) return { kind: "resource-stop", stop: initial };
  const checks = bindingChecks(bindings, typeCount);
  const violations: Violation<TypeRule, TypeSite>[] = [];
  for (;;) {
    const cursor = admit(1, 1);
    if (cursor !== null) return { kind: "resource-stop", stop: cursor };
    const step = checks.next();
    if (step.done) return { kind: "complete", violations };
    if (step.value.kind === "work") {
      const work = admit(step.value.units, 0);
      if (work !== null) return { kind: "resource-stop", stop: work };
    } else violations.push(step.value.violation);
  }
};
