import type { Node } from "@tsonic/tsts";
import { sourceFiniteLiteralDomain } from "../source-model/literals/domain.js";
import type {
  SourceResult, SourceSumApplication, SourceSumFamily, SourceTypeBinding,
  SourceTypeComponent, SourceTypeEvidence,
} from "../public/source/contracts.js";
import type { SourceComponentOwner } from "./descriptor-components.js";
import type { SourceEvidenceOwner } from "./descriptor-evidence.js";
import type { SourceDescriptorInterner } from "./descriptor-interner.js";
import type { SourceParameterOwner } from "./descriptor-parameters.js";

export interface SourceFamilyOwner {
  assertFamily(value: SourceSumFamily): void;
  assertApplication(value: SourceSumApplication): void;
  publish(component: SourceTypeComponent, origin: "authored" | "inferred", parameters: readonly Node[], roles: readonly SourceTypeEvidence[]): SourceSumFamily;
  apply(family: SourceSumFamily, bindings: readonly SourceTypeBinding[]): SourceResult<SourceSumApplication>;
  present(value: SourceSumApplication): SourceSumApplication;
  retainSelection(original: SourceSumApplication, value: SourceSumApplication): SourceSumApplication;
}

export function createSourceFamilyOwner(input: {
  components: SourceComponentOwner;
  evidence: SourceEvidenceOwner;
  interner: SourceDescriptorInterner;
  parameters: SourceParameterOwner;
  substitute(value: SourceTypeEvidence, bindings: readonly SourceTypeBinding[]): SourceResult<SourceTypeEvidence>;
}): SourceFamilyOwner {
  const families = new WeakSet<SourceSumFamily>();
  const applications = new WeakSet<SourceSumApplication>();
  const originals = new Map<string, SourceSumFamily>();
  const applied = new WeakMap<SourceSumFamily, Map<string, SourceResult<SourceSumApplication>>>();
  const selections = new WeakMap<SourceSumApplication, Map<string, SourceSumApplication>>();
  const presentSelections = new WeakSet<SourceSumApplication>();

  function assertFamily(value: SourceSumFamily): void {
    if (!families.has(value)) throw new Error("A Source sum family requires its exact original descriptor view.");
  }

  function assertApplication(value: SourceSumApplication): void {
    if (!applications.has(value)) throw new Error("A Source sum application requires its exact original descriptor view.");
  }

  function publish(component: SourceTypeComponent, origin: "authored" | "inferred", parameters: readonly Node[], roles: readonly SourceTypeEvidence[]): SourceSumFamily {
    input.components.assert(component);
    if (roles.length === 0) throw new Error("An original Source family must contain its real role vector.");
    const seen = new Set<Node>();
    for (const declaration of parameters) {
      input.parameters.get(declaration);
      if (seen.has(declaration)) throw new Error("An original Source family cannot repeat a binder.");
      seen.add(declaration);
    }
    for (const value of roles) {
      input.evidence.assert(value);
      for (const parameter of input.parameters.free(value)) {
        if (!seen.has(parameter.declaration)) throw new Error("A Source family must retain every original free binder, including captured binders.");
      }
    }
    const key = JSON.stringify([input.components.objectKey(component), origin, parameters.map(input.components.objectKey), roles.map(input.components.objectKey)]);
    const previous = originals.get(key);
    if (previous !== undefined) return previous;
    const selected: SourceSumFamily = Object.freeze({ origin, component,
      parameters: Object.freeze([...parameters]),
      roles: Object.freeze(roles.map((template, index) => Object.freeze({ index, component: template.component, template }))) });
    families.add(selected);
    originals.set(key, selected);
    return selected;
  }

  function apply(family: SourceSumFamily, bindings: readonly SourceTypeBinding[]): SourceResult<SourceSumApplication> {
    assertFamily(family);
    const selectedBindings = input.parameters.bindings(bindings);
    let previousIndex = -1;
    for (const binding of selectedBindings) {
      const index = family.parameters.indexOf(binding.declaration);
      if (index <= previousIndex) throw new Error("A Source family application requires the original ordered binder vector.");
      previousIndex = index;
    }
    const key = JSON.stringify(selectedBindings.map(binding => [input.components.objectKey(binding.declaration), input.components.objectKey(binding.value)]));
    let entries = applied.get(family);
    if (entries === undefined) { entries = new Map(); applied.set(family, entries); }
    const previous = entries.get(key);
    if (previous !== undefined) return previous;
    const arms: SourceTypeEvidence[] = [];
    const roles: SourceSumApplication["roles"][number][] = [];
    const freeParameters = new Map<Node, ReturnType<SourceParameterOwner["get"]>>();

    function append(value: SourceTypeEvidence, indexes: number[], unionContext = family.roles.length > 1): void {
      if (value.type.kind === "intrinsic" && value.type.intrinsic === "never") return;
      if (value.sum !== undefined) {
        for (const arm of value.sum.arms) append(arm, indexes, unionContext || value.sum.arms.length > 1);
        return;
      }
      if (value.type.kind === "optional") {
        const child = input.evidence.record(value).components.get(input.components.selectorKey({ kind: "optional-value" }));
        if (child === undefined) throw new Error("An optional Source role must publish its original present component.");
        append(child.value, indexes, true);
        const absence = input.evidence.create({ type: input.interner.intrinsic("absence"), component: value.component,
          category: { kind: "known", category: "absence" }, numeric: undefined, sum: undefined }, [], undefined,
        sourceFiniteLiteralDomain([{ kind: "absence" }]), []);
        append(absence, indexes);
        return;
      }
      if (value.type.kind === "union") throw new Error("A Source union role must retain its original nested family application.");
      const selected = value.type.kind === "intrinsic" && value.type.intrinsic === "void" && unionContext
        ? input.evidence.create({ type: input.interner.intrinsic("absence"), component: value.component,
          category: { kind: "known", category: "absence" }, numeric: undefined, sum: undefined }, [], undefined,
        sourceFiniteLiteralDomain([{ kind: "absence" }]), [])
        : value;
      let index = arms.indexOf(selected);
      if (index < 0) { index = arms.length; arms.push(selected); }
      if (!indexes.includes(index)) indexes.push(index);
    }

    for (const role of family.roles) {
      const result = input.substitute(role.template, selectedBindings);
      if (result.kind === "refused") { entries.set(key, result); return result; }
      const value = result.value;
      const armIndexes: number[] = [];
      append(value, armIndexes);
      roles.push(Object.freeze({ role, value, armIndexes: Object.freeze(armIndexes) }));
      for (const parameter of input.parameters.free(value)) freeParameters.set(parameter.declaration, parameter);
    }
    const application: SourceSumApplication = Object.freeze({ kind: freeParameters.size === 0 ? "closed" : "open",
      freeParameters: Object.freeze([...freeParameters.values()]), family, bindings: selectedBindings,
      arms: Object.freeze(arms), roles: Object.freeze(roles) });
    applications.add(application);
    const result = Object.freeze({ kind: "resolved" as const, value: application });
    entries.set(key, result);
    return result;
  }

  function select(value: SourceSumApplication, indexes: readonly number[]): SourceSumApplication {
    assertApplication(value);
    let prior = -1;
    for (const index of indexes) {
      if (!Number.isSafeInteger(index) || index <= prior || index >= value.arms.length) throw new Error("A Source family selection requires its exact ordered arm subset.");
      prior = index;
    }
    if (indexes.length === value.arms.length) return value;
    let entries = selections.get(value);
    if (entries === undefined) { entries = new Map(); selections.set(value, entries); }
    const key = JSON.stringify(indexes);
    const previous = entries.get(key);
    if (previous !== undefined) return previous;
    const arms = indexes.map(index => value.arms[index]!);
    const positions = new Map(indexes.map((index, position) => [index, position]));
    const free = new Map<Node, ReturnType<SourceParameterOwner["get"]>>();
    for (const arm of arms) for (const parameter of input.parameters.free(arm)) free.set(parameter.declaration, parameter);
    const selected: SourceSumApplication = Object.freeze({ kind: free.size === 0 ? "closed" : "open",
      freeParameters: Object.freeze([...free.values()]), family: value.family, bindings: value.bindings,
      arms: Object.freeze(arms), roles: Object.freeze(value.roles.map(role => Object.freeze({ ...role,
        armIndexes: Object.freeze(role.armIndexes.flatMap(index => {
          const position = positions.get(index);
          return position === undefined ? [] : [position];
        })) }))) });
    applications.add(selected);
    entries.set(key, selected);
    return selected;
  }

  function present(value: SourceSumApplication): SourceSumApplication {
    assertApplication(value);
    const indexes = value.arms.flatMap((arm, index) => arm.type.kind === "intrinsic" && arm.type.intrinsic === "absence" ? [] : [index]);
    const selected = select(value, indexes);
    if (selected !== value) presentSelections.add(selected);
    return selected;
  }

  return Object.freeze({ assertFamily, assertApplication, publish, apply, present,
    retainSelection(original: SourceSumApplication, value: SourceSumApplication): SourceSumApplication {
      assertApplication(original);
      assertApplication(value);
      if (original.family !== value.family) throw new Error("A Source family substitution must retain its exact original family.");
      return presentSelections.has(original) ? present(value) : value;
    } });
}
