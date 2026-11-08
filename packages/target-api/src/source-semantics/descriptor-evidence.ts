import type { Node } from "@tsonic/tsts";
import type { SourceInputComponent } from "../host-input/identities.js";
import { sourceFiniteLiteralDomain, sourceLiteralDomainsEqual, type SourceLiteralDomain } from "../source-model/literals/domain.js";
import type {
  SourceCategoryDomain, SourceComponentSelector, SourceMemberOrigin, SourceNumericOrigin, SourceSumApplication, SourceTypeDescriptor,
  SourceTypeDescriptorSignature,
  SourceTypeBinding, SourceTypeEvidence,
} from "../public/source/contracts.js";
import type { SourceEvidenceComponent } from "./descriptor-contracts.js";
import type { SourceComponentOwner } from "./descriptor-components.js";
import type { SourceEvidenceDetails } from "./member-inventory.js";
import { createSourceEvidenceDetailsOwner } from "./descriptor-details.js";

export interface SourceEvidenceRecord {
  readonly value: SourceTypeEvidence;
  readonly components: ReadonlyMap<string, SourceEvidenceComponent>;
  readonly original: SourceInputComponent | undefined;
  readonly domain: SourceLiteralDomain;
  readonly requirementBindings: readonly SourceTypeBinding[];
  readonly details: SourceEvidenceDetails;
}

export interface SourceEvidenceOwner {
  details(value: SourceEvidenceDetails): SourceEvidenceDetails;
  assert(value: SourceTypeEvidence): void;
  record(value: SourceTypeEvidence): SourceEvidenceRecord;
  create(value: SourceTypeEvidence, children: readonly SourceEvidenceComponent[], original: SourceInputComponent | undefined, domain: SourceLiteralDomain, requirementBindings: readonly SourceTypeBinding[], details: SourceEvidenceDetails): SourceTypeEvidence;
  category(value: SourceCategoryDomain): SourceCategoryDomain;
  categoryKey(value: SourceCategoryDomain): string;
  equivalent(left: SourceTypeEvidence, right: SourceTypeEvidence): boolean;
}

export function createSourceEvidenceOwner(input: {
  components: SourceComponentOwner;
  assertNode(node: Node): void;
  assertDescriptor(value: SourceTypeDescriptor): void;
  assertOriginal(value: SourceInputComponent): void;
  assertSum(value: SourceSumApplication): void;
}): SourceEvidenceOwner {
  const records = new WeakMap<SourceTypeEvidence, SourceEvidenceRecord>();
  const categories = new Map<string, SourceCategoryDomain>();
  const equivalences = new WeakMap<SourceTypeEvidence, WeakMap<SourceTypeEvidence, boolean>>();
  const freezeDetails = createSourceEvidenceDetailsOwner({ assertNode: input.assertNode,
    assertEvidence: value => { record(value); } });

  function categoryKey(value: SourceCategoryDomain): string {
    switch (value.kind) {
      case "known": return JSON.stringify([value.kind, value.category]);
      case "dynamic": return value.kind;
      case "parameter": {
        input.assertNode(value.declaration);
        return JSON.stringify([value.kind, input.components.objectKey(value.declaration)]);
      }
      case "choice": return JSON.stringify([value.kind, value.alternatives.map(categoryKey)]);
    }
  }

  function category(value: SourceCategoryDomain): SourceCategoryDomain {
    const key = categoryKey(value);
    const previous = categories.get(key);
    if (previous !== undefined) return previous;
    const selected = value.kind === "choice"
      ? Object.freeze({ kind: "choice" as const, alternatives: Object.freeze(value.alternatives.map(category)) })
      : Object.freeze({ ...value });
    categories.set(key, selected);
    return selected;
  }

  function record(value: SourceTypeEvidence): SourceEvidenceRecord {
    const selected = records.get(value);
    if (selected === undefined) throw new Error("Source type evidence must belong to this exact descriptor view.");
    return selected;
  }

  function numeric(value: SourceNumericOrigin | undefined): SourceNumericOrigin | undefined {
    if (value === undefined) return undefined;
    input.assertNode(value.producer);
    return Object.freeze({ ...value, category: category(value.category) });
  }

  function equivalent(left: SourceTypeEvidence, right: SourceTypeEvidence): boolean {
    const from = record(left), to = record(right);
    if (left === right) return true;
    if (left.type !== right.type || categoryKey(left.category) !== categoryKey(right.category) ||
      !sourceLiteralDomainsEqual(from.domain, to.domain) || from.components.size !== to.components.size ||
      from.requirementBindings.length !== to.requirementBindings.length) return false;
    let previous = equivalences.get(left);
    const retained = previous?.get(right);
    if (retained !== undefined) return retained;
    if (previous === undefined) { previous = new WeakMap(); equivalences.set(left, previous); }
    previous.set(right, true);
    for (const [key, child] of from.components) {
      const other = to.components.get(key);
      if (other === undefined || !equivalent(child.value, other.value)) { previous.set(right, false); return false; }
    }
    const bindings = new Map(to.requirementBindings.map(binding => [binding.declaration, binding.value]));
    for (const binding of from.requirementBindings) {
      const other = bindings.get(binding.declaration);
      if (other === undefined || !equivalent(binding.value, other)) { previous.set(right, false); return false; }
    }
    if (!memberEvidenceEquivalent(from, to)) { previous.set(right, false); return false; }
    return true;
  }

  function memberEvidenceEquivalent(from: SourceEvidenceRecord, to: SourceEvidenceRecord): boolean {
    const left = from.details.members, right = to.details.members;
    if (left === right || from.value.type.kind !== "shape" && from.value.type.kind !== "callable") return true;
    if (left.kind !== "complete" || right.kind !== "complete") return from.original !== undefined && from.original === to.original;
    if (left.members.length !== right.members.length || left.indexes.length !== right.indexes.length) return false;
    const nodesEqual = (first: readonly Node[], second: readonly Node[]): boolean => first.length === second.length &&
      first.every((node, index) => node === second[index]);
    const originsEqual = (first: readonly SourceMemberOrigin[], second: readonly SourceMemberOrigin[]): boolean => first.length === second.length &&
      first.every((origin, index) => input.components.selectorKey({ kind: "member", origin }) ===
        input.components.selectorKey({ kind: "member", origin: second[index]! }));
    const childrenEqual = (origins: readonly SourceMemberOrigin[]): boolean => origins.length > 0 && origins.every(origin => {
      const key = input.components.selectorKey({ kind: "member", origin });
      const first = from.components.get(key), second = to.components.get(key);
      return first !== undefined && second !== undefined && equivalent(first.value, second.value);
    });
    for (const [index, first] of left.members.entries()) {
      const second = right.members[index]!;
      const sameKey = first.key.kind === "name" ? second.key.kind === "name" && first.key.name === second.key.name
        : second.key.kind === "symbol" && first.key.declaration === second.key.declaration;
      if (!sameKey || first.name !== second.name || first.read !== second.read || first.optional !== second.optional ||
        first.readonly !== second.readonly || !nodesEqual(first.declarations, second.declarations) ||
        !nodesEqual(first.getters, second.getters) || !nodesEqual(first.setters, second.setters) ||
        !originsEqual(first.origins, second.origins) || !originsEqual(first.readOrigins, second.readOrigins) ||
        !originsEqual(first.writeOrigins, second.writeOrigins)) return false;
      if (first.read !== "unavailable" && first.readType !== second.readType && !childrenEqual(first.readOrigins)) return false;
      if (!first.readonly && first.writeType !== second.writeType && !childrenEqual(first.writeOrigins)) return false;
    }
    for (const [index, first] of left.indexes.entries()) {
      const second = right.indexes[index]!;
      if (first.readonly !== second.readonly || !nodesEqual(first.declarations, second.declarations)) return false;
      if (first.keyType !== second.keyType || first.readType !== second.readType ||
        !first.readonly && first.writeType !== second.writeType) return false;
    }
    return true;
  }

  function requireChildren(value: SourceTypeEvidence, entries: ReadonlyMap<string, SourceEvidenceComponent>): void {
    function child(selector: SourceComponentSelector, type: SourceTypeDescriptor): void {
      const selected = entries.get(input.components.selectorKey(selector));
      if (selected === undefined || selected.value.type !== type)
        throw new Error("Every Source descriptor component requires its exact registered child evidence.");
    }
    function signature(value: SourceTypeDescriptorSignature): void {
      if (value.receiver !== undefined) child({ kind: "receiver", signature: value.identity }, value.receiver.type);
      for (const [index, parameter] of value.parameters.entries())
        child({ kind: "parameter", signature: value.identity, index }, parameter.type);
      child({ kind: "result", signature: value.identity }, value.result);
    }
    const type = value.type;
    switch (type.kind) {
      case "primitive": case "string": case "intrinsic": case "parameter": break;
      case "optional": child({ kind: "optional-value" }, type.value); break;
      case "array": child({ kind: "array-element" }, type.element); break;
      case "tuple":
        for (const [index, element] of type.elements.entries()) child({ kind: "tuple-element", index }, element.type);
        break;
      case "declared":
        for (const [index, argument] of type.typeArguments.entries()) child({ kind: "type-argument", declaration: type.declaration, index }, argument);
        break;
      case "projection": child({ kind: "projection-source" }, type.source); break;
      case "shape":
        for (const member of type.members) child({ kind: "member", origin: member.origin }, member.type);
        for (const index of type.indexes) {
          child({ kind: "index-key", declaration: index.declaration }, index.key);
          child({ kind: "index-value", declaration: index.declaration }, index.value);
        }
        for (const selected of [...type.calls, ...type.constructs]) signature(selected);
        break;
      case "callable":
        for (const selected of [...type.calls, ...type.constructs]) signature(selected);
        break;
      case "union":
        if (value.sum === undefined) throw new Error("A Source union requires its original authenticated family application.");
        break;
    }
    if (value.sum !== undefined) for (const [index, arm] of value.sum.arms.entries()) {
      const selected = entries.get(input.components.selectorKey({ kind: "sum-arm", family: value.sum.family, index }));
      if (selected?.value !== arm) throw new Error("A Source sum requires each exact authenticated arm as registered child evidence.");
    }
  }

  function create(value: SourceTypeEvidence, children: readonly SourceEvidenceComponent[], original: SourceInputComponent | undefined, domain: SourceLiteralDomain, requirementBindings: readonly SourceTypeBinding[], details: SourceEvidenceDetails): SourceTypeEvidence {
    input.assertDescriptor(value.type);
    input.components.assert(value.component);
    if (original !== undefined) input.assertOriginal(original);
    if (value.sum !== undefined) input.assertSum(value.sum);
    const selectedCategory = category(value.category);
    const selectedNumeric = numeric(value.numeric);
    if (domain.kind === "finite") for (const unit of domain.values) {
      if (unit.kind === "symbol") input.assertNode(unit.declaration);
    }
    const selectedDomain = domain.kind === "finite" ? sourceFiniteLiteralDomain(domain.values) : Object.freeze({ ...domain });
    const entries = new Map<string, SourceEvidenceComponent>();
    const bound = new Set<Node>();
    for (const binding of requirementBindings) {
      input.assertNode(binding.declaration);
      record(binding.value);
      if (bound.has(binding.declaration)) throw new Error("A requirement environment binds each original parameter exactly once.");
      bound.add(binding.declaration);
    }
    for (const child of children) {
      record(child.value);
      const selectorKey = input.components.selectorKey(child.selector);
      const previous = entries.get(selectorKey);
      if (previous !== undefined && previous.value !== child.value) throw new Error("A Source evidence component requires one exact published child.");
      const childComponent = input.components.identity(value.component.root, [...value.component.path, child.selector]);
      entries.set(selectorKey, Object.freeze({ selector: childComponent.path[childComponent.path.length - 1]!, value: child.value }));
    }
    requireChildren(value, entries);
    const selected: SourceTypeEvidence = Object.freeze({ type: value.type, component: value.component,
      category: selectedCategory, numeric: selectedNumeric, sum: value.sum });
    const selectedDetails = freezeDetails(details);
    records.set(selected, Object.freeze({ value: selected, components: entries, original, domain: selectedDomain,
      requirementBindings: Object.freeze(requirementBindings.map(binding => Object.freeze({ ...binding }))), details: selectedDetails }));
    return selected;
  }

  return Object.freeze({ details: freezeDetails, assert: (value: SourceTypeEvidence): void => { record(value); }, record, create, category, categoryKey, equivalent });
}
