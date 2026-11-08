import type { SourceInputComponent } from "../host-input/identities.js";
import type {
  SourceComponentSelector, SourceDeferredProjection, SourceResult, SourceSumApplication, SourceTypeBinding, SourceTypeComponent,
  SourceTypeDescriptor, SourceTypeDescriptorSignature, SourceTypeEvidence,
} from "../public/source/contracts.js";
import type { SourceComponentOwner } from "./descriptor-components.js";
import type { SourceEvidenceComponent } from "./descriptor-contracts.js";
import type { SourceEvidenceOwner } from "./descriptor-evidence.js";
import type { SourceDescriptorInterner } from "./descriptor-interner.js";
import type { SourceParameterOwner } from "./descriptor-parameters.js";
import { substituteSourceEvidenceDetails } from "./descriptor-details.js";

export function createSourceSubstitution(input: {
  components: SourceComponentOwner;
  evidence: SourceEvidenceOwner;
  interner: SourceDescriptorInterner;
  parameters: SourceParameterOwner;
  applyFamily(value: SourceSumApplication, bindings: readonly SourceTypeBinding[]): SourceResult<SourceSumApplication>;
  materialize(component: SourceTypeComponent, application: SourceSumApplication, original: SourceInputComponent | undefined): SourceTypeEvidence;
  intersection(component: SourceTypeComponent, parts: readonly SourceTypeEvidence[], result: SourceTypeEvidence,
    original: SourceInputComponent | undefined): SourceTypeEvidence;
  project(originalSource: SourceTypeEvidence, source: SourceTypeEvidence, projection: SourceDeferredProjection,
    bindings: readonly SourceTypeBinding[]): SourceResult<SourceTypeEvidence>;
}): (value: SourceTypeEvidence, bindings: readonly SourceTypeBinding[]) => SourceResult<SourceTypeEvidence> {
  const results = new WeakMap<SourceTypeEvidence, Map<string, SourceResult<SourceTypeEvidence>>>();

  function substitute(value: SourceTypeEvidence, bindings: readonly SourceTypeBinding[]): SourceResult<SourceTypeEvidence> {
    const record = input.evidence.record(value);
    const selectedBindings = input.parameters.bindings(bindings);
    const environment = new Map(record.requirementBindings.map(binding => [binding.declaration, binding]));
    for (const binding of selectedBindings) environment.set(binding.declaration, binding);
    const requirementBindings = Object.freeze([...environment.values()]);
    const free = input.parameters.free(value);
    if (!selectedBindings.some(binding => free.some(parameter => parameter.declaration === binding.declaration))) {
      return { kind: "resolved", value };
    }
    const identity = JSON.stringify(selectedBindings.map(binding => [input.components.objectKey(binding.declaration), input.components.objectKey(binding.value)]));
    let entries = results.get(value);
    if (entries === undefined) { entries = new Map(); results.set(value, entries); }
    const previous = entries.get(identity);
    if (previous !== undefined) return previous;
    let result: SourceResult<SourceTypeEvidence>;
    if (value.type.kind === "intersection") {
      const parts: SourceTypeEvidence[] = [];
      for (const [index, type] of value.type.types.entries()) {
        const original = record.components.get(input.components.selectorKey({ kind: "intersection-member", index }));
        if (original === undefined || original.value.type !== type)
          throw new Error("A substituted Source conjunction requires every exact original part's evidence.");
        const selected = substitute(original.value, selectedBindings);
        if (selected.kind === "refused") { entries.set(identity, selected); return selected; }
        parts.push(selected.value);
      }
      const reduction = record.components.get(input.components.selectorKey({ kind: "intersection-result" }));
      if (reduction === undefined) throw new Error("A substituted Source conjunction requires its canonical reduction evidence.");
      const selected = substitute(reduction.value, selectedBindings);
      result = selected.kind === "refused" ? selected : { kind: "resolved",
        value: input.intersection(value.component, parts, selected.value, record.original) };
    } else if (value.sum !== undefined) {
      const selected = input.applyFamily(value.sum, selectedBindings);
      result = selected.kind === "refused" ? selected
        : { kind: "resolved", value: input.materialize(value.component, selected.value, record.original) };
    } else if (value.type.kind === "parameter") {
      const declaration = value.type.declaration;
      const binding = selectedBindings.find(candidate => candidate.declaration === declaration);
      if (binding === undefined || binding.value === value) {
        const retained = input.evidence.create(value, [...record.components.values()], record.original, record.domain, requirementBindings, record.details);
        const selected = { kind: "resolved" as const, value: retained };
        entries.set(identity, selected);
        return selected;
      }
      const remaining = selectedBindings.filter(candidate => candidate.declaration !== declaration);
      const replacement = substitute(binding.value, remaining);
      if (replacement.kind === "refused") result = replacement;
      else {
        const source = input.evidence.record(replacement.value);
        result = { kind: "resolved", value: input.evidence.create({ ...replacement.value, component: value.component },
          [...source.components.values()], source.original, source.domain, source.requirementBindings, source.details) };
      }
    } else {
      const children: SourceEvidenceComponent[] = [];
      for (const child of record.components.values()) {
        const signature = selectedSignature(child.selector);
        const remaining = signature === undefined ? selectedBindings
          : selectedBindings.filter(binding => !signature.typeParameters.includes(binding.declaration));
        const selected = substitute(child.value, remaining);
        if (selected.kind === "refused") { entries.set(identity, selected); return selected; }
        children.push({ selector: child.selector, value: selected.value });
      }
      const childMap = new Map(children.map(child => [input.components.selectorKey(child.selector), child.value]));
      const details = substituteSourceEvidenceDetails(record.details, child => substitute(child, selectedBindings),
        selectedBindings, substitute);
      function child(selector: SourceComponentSelector, original: SourceTypeDescriptor): SourceTypeDescriptor {
        const key = input.components.selectorKey(selector);
        const prior = record.components.get(key);
        const selected = childMap.get(key);
        if (prior === undefined || selected === undefined || prior.value.type !== original) {
          throw new Error("Substitution requires the exact original evidence for every Source descriptor component.");
        }
        return selected.type;
      }
      if (value.type.kind === "projection") {
        const selector = input.components.selectorKey({ kind: "projection-source" });
        const original = record.components.get(selector);
        const selected = childMap.get(selector);
        if (original === undefined || selected === undefined) throw new Error("A Source projection must retain its exact original source evidence.");
        if (input.parameters.free(selected).length === 0) {
          const projected = input.project(original.value, selected, value.type.projection, selectedBindings);
          if (projected.kind === "refused") result = projected;
          else {
            const record = input.evidence.record(projected.value);
            result = { kind: "resolved", value: input.evidence.create({ ...projected.value, component: value.component },
              [...record.components.values()], record.original, record.domain, record.requirementBindings, record.details) };
          }
        } else result = { kind: "resolved", value: input.evidence.create({ ...value,
          type: input.interner.projection(selected.type, value.type.projection),
          category: input.parameters.category(value.category, selectedBindings) }, children, record.original, record.domain, requirementBindings, details) };
      } else {
        const type = rebuild(value.type, child, input.interner);
        const category = input.parameters.category(value.category, selectedBindings);
        const numeric = value.numeric === undefined ? undefined
          : { ...value.numeric, category: input.parameters.category(value.numeric.category, selectedBindings) };
        result = { kind: "resolved", value: input.evidence.create({ type, component: value.component,
          category, numeric, sum: undefined }, children, record.original, record.domain, requirementBindings, details) };
      }
    }
    entries.set(identity, result);
    return result;
  }

  return substitute;
}

function selectedSignature(selector: SourceComponentSelector): SourceTypeDescriptorSignature["identity"] | undefined {
  return selector.kind === "parameter" || selector.kind === "receiver" || selector.kind === "result" || selector.kind === "signature-tail"
    ? selector.signature : undefined;
}

function rebuild(type: SourceTypeDescriptor,
  child: (selector: SourceComponentSelector, original: SourceTypeDescriptor) => SourceTypeDescriptor,
  interner: SourceDescriptorInterner): SourceTypeDescriptor {
  function signature(value: SourceTypeDescriptorSignature): SourceTypeDescriptorSignature {
    return { identity: value.identity,
      ...(value.receiver === undefined ? {} : { receiver: { ...value.receiver,
        type: child({ kind: "receiver", signature: value.identity }, value.receiver.type) } }),
      parameters: value.parameters.map((parameter, index) => ({ ...parameter,
        type: child({ kind: "parameter", signature: value.identity, index }, parameter.type) })),
      result: child({ kind: "result", signature: value.identity }, value.result) };
  }
  switch (type.kind) {
    case "primitive": case "intrinsic": case "string": case "parameter": return type;
    case "optional": return interner.optional(child({ kind: "optional-value" }, type.value));
    case "array": return interner.array(child({ kind: "array-element" }, type.element), type.readonly);
    case "tuple": return interner.tuple(type.elements.map((element, index) => ({ ...element,
      type: child({ kind: "tuple-element", index }, element.type) })), type.readonly);
    case "declared": return interner.declared({ ...type, typeArguments: type.typeArguments.map((argument, index) =>
      child({ kind: "type-argument", declaration: type.declaration, index }, argument)) });
    case "construction-reference": return interner.constructionReference(type.definition, type.typeArguments.map((argument, index) =>
      child({ kind: "construction-argument", definition: type.definition, index }, argument)));
    case "callable": return interner.callable({ calls: type.calls.map(signature), constructs: type.constructs.map(signature) });
    case "shape": return interner.shape({ members: type.members.map(member => ({ ...member,
      type: child({ kind: "member", origin: member.origin }, member.type) })),
      indexes: type.indexes.map(index => ({ ...index,
        key: child({ kind: "index-key", declaration: index.declaration }, index.key),
        value: child({ kind: "index-value", declaration: index.declaration }, index.value) })),
      calls: type.calls.map(signature), constructs: type.constructs.map(signature) });
    case "union": throw new Error("A substituted Source union must be rebuilt through its original family application.");
    case "intersection": throw new Error("A substituted Source conjunction must retain its original parts and canonical reduction evidence.");
    case "projection": throw new Error("A Source projection must pass through its canonical projection producer.");
  }
}
