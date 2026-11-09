import type { Node } from "@tsonic/tsts";
import type { SourceInputLayoutIdentity, SourceInputMemoryFieldIdentity } from "../host-input/memory-input.js";
import type { SourcePresence, SourceTypeBinding } from "../public/source/contracts.js";
import type { SourceCorrespondenceMember } from "../source-model/members.js";
import type { SourceMemoryMetadata, SourceMemorySelection } from "../source-model/memory.js";
import type { SourceMemoryField, SourceMemoryLayout } from "../source-model/pointers.js";
import type { SourceMemoryContext } from "./source-memory-context.js";

export function createSourceMemoryMetadataProduction(context: SourceMemoryContext) {
  const { source, view, assertNode, original, bindingKey, equivalent } = context;
  const layouts = new WeakMap<SourceInputLayoutIdentity, Map<string, SourceMemoryLayout>>();
  const fields = new WeakMap<SourceInputMemoryFieldIdentity, Map<string, SourceMemoryField>>();
  const appliedLayouts = new WeakMap<SourceInputLayoutIdentity, Map<string, SourceMemoryLayout>>();
  const appliedFields = new WeakMap<SourceInputMemoryFieldIdentity, Map<string, SourceMemoryField>>();
  const metadataValues = new WeakMap<SourceMemoryLayout | SourceMemoryField, SourceMemoryMetadata>();
  const identities = new WeakMap<object, number>();
  let nextIdentity = 0;
  const active = new WeakMap<object, Set<string>>();
  const none = Object.freeze({ kind: "none" } as const);
  const resolved = <Value>(value: Value): SourceMemorySelection<Value> => Object.freeze({ kind: "resolved", value });
  const unresolved = (reason: string) => Object.freeze({ kind: "unresolved" as const, reason });
  function identityKey(value: object): number {
    const previous = identities.get(value);
    if (previous !== undefined) return previous;
    const result = nextIdentity++;
    identities.set(value, result);
    return result;
  }
  function enter(identity: object, key: string): () => void {
    let selected = active.get(identity);
    if (selected?.has(key)) throw new Error("A finalized memory value cannot recursively contain its physical layout.");
    if (selected === undefined) { selected = new Set(); active.set(identity, selected); }
    selected.add(key);
    return () => { selected.delete(key); };
  }
  function layout(identity: SourceInputLayoutIdentity, bindings: readonly SourceTypeBinding[]): SourceMemorySelection<SourceMemoryLayout> {
    assertNode(identity.occurrence);
    const key = bindingKey(bindings);
    const selected = original.layout(identity);
    if (selected.kind !== "available") return unresolved(selected.kind === "unavailable" ? selected.reason
      : "A memory layout requires its finalized original Core receipt.");
    const component = context.component(selected.value.source, bindings);
    if (component.kind !== "resolved") return component;
    const previous = layouts.get(identity)?.get(key);
    if (previous !== undefined) return resolved(previous);
    const leave = enter(identity, key);
    try {
      const originalLayout = selected.value;
      const value = component.value.value;
      const base = { occurrence: originalLayout.occurrence, source: value, dataLayout: originalLayout.dataLayout,
        byteSize: originalLayout.byteSize, byteAlignment: originalLayout.byteAlignment, stride: originalLayout.stride };
      let result: SourceMemoryLayout;
      if (originalLayout.kind === "array") {
        if (value.type.kind !== "declared" || value.type.extent === undefined ||
          value.type.extent.length !== originalLayout.extent.length || value.type.extent.runtimeBase !== originalLayout.extent.runtimeBase)
          return unresolved("A memory array requires the same original Source extent and runtime base as its finalized layout.");
        const child = layout(originalLayout.element, bindings);
        if (child.kind !== "resolved") return child;
        const element = view.component(value, { kind: "type-argument", declaration: value.type.declaration, index: 0 });
        if (element.kind === "refused") return element;
        if (!equivalent(element.value, child.value.source))
          return unresolved("A memory array requires its exact Source element and finalized child layout.");
        result = Object.freeze({ ...base, kind: "array", extent: value.type.extent, element: child.value });
      } else {
        const selectedFields: SourceMemoryField[] = [];
        for (const identity of originalLayout.fields) {
          const child = field(identity, bindings);
          if (child.kind !== "resolved") return child;
          if (!equivalent(value, child.value.owner))
            return unresolved("Every aggregate memory field must retain the same canonical Source owner.");
          selectedFields.push(child.value);
        }
        result = Object.freeze({ ...base, kind: "value", fields: Object.freeze(selectedFields) });
      }
      const appliedKey = [identityKey(value), ...(result.kind === "array" ? [identityKey(result.element)]
        : result.fields.map(identityKey))].join(",");
      let applied = appliedLayouts.get(identity);
      if (applied === undefined) { applied = new Map(); appliedLayouts.set(identity, applied); }
      const canonical = applied.get(appliedKey);
      if (canonical !== undefined) result = canonical;
      else applied.set(appliedKey, result);
      let retained = layouts.get(identity);
      if (retained === undefined) { retained = new Map(); layouts.set(identity, retained); }
      retained.set(key, result);
      return resolved(result);
    } finally { leave(); }
  }
  function field(identity: SourceInputMemoryFieldIdentity, bindings: readonly SourceTypeBinding[]): SourceMemorySelection<SourceMemoryField> {
    assertNode(identity.occurrence);
    const key = bindingKey(bindings);
    const selected = original.field(identity);
    if (selected.kind !== "available") return unresolved(selected.kind === "unavailable" ? selected.reason
      : "A memory field requires its finalized original Core receipt.");
    const owner = context.component(selected.value.owner, bindings);
    if (owner.kind !== "resolved") return owner;
    const value = context.component(selected.value.value, bindings);
    if (value.kind !== "resolved") return value;
    const previous = fields.get(identity)?.get(key);
    if (previous !== undefined) return resolved(previous);
    const leave = enter(identity, key);
    try {
      const originalField = selected.value;
      assertNode(originalField.selector); assertNode(originalField.selection);
      if (originalField.primary.kind === "present") assertNode(originalField.primary.value);
      const members = new Set<SourceCorrespondenceMember>();
      for (const declaration of originalField.selectedDeclarations) {
        assertNode(declaration);
        const member = source.facts.objects.correspondingMember(owner.value.value, owner.value.value, declaration, "read");
        if (member.kind === "refused") return member;
        if (member.value.kind === "none" || member.value.value.kind !== "present")
          return unresolved("A memory field requires every original selected declaration in the canonical Source member inventory.");
        members.add(member.value.value.source);
      }
      if (members.size !== 1)
        return unresolved("A memory selector requires one canonical Source member retaining every original selection.");
      const member = members.values().next().value!;
      if (member.read !== "property" || member.optional || member.readType === undefined ||
        !equivalent(member.readType, value.value.value))
        return unresolved("A memory field requires its exact present physical Source field component.");
      const child = layout(originalField.layout, bindings);
      if (child.kind !== "resolved") return child;
      if (!equivalent(value.value.value, child.value.source))
        return unresolved("A memory field requires its exact Source child and finalized layout.");
      const { receiver, readType, writeType, ...identityMember } = member;
      const appliedKey = [owner.value.value, value.value.value, child.value].map(identityKey).join(",");
      let applied = appliedFields.get(identity);
      if (applied === undefined) { applied = new Map(); appliedFields.set(identity, applied); }
      const result: SourceMemoryField = applied.get(appliedKey) ?? Object.freeze({ occurrence: identity.occurrence, owner: owner.value.value,
        selector: originalField.selector, selection: originalField.selection, member: Object.freeze(identityMember),
        primary: originalField.primary, selectedDeclarations: originalField.selectedDeclarations,
        value: value.value.value, layout: child.value, byteOffset: originalField.byteOffset, byteAlignment: originalField.byteAlignment });
      applied.set(appliedKey, result);
      let retained = fields.get(identity);
      if (retained === undefined) { retained = new Map(); fields.set(identity, retained); }
      retained.set(key, result);
      return resolved(result);
    } finally { leave(); }
  }
  function value(occurrence: Node, bindings: readonly SourceTypeBinding[]): SourceMemorySelection<SourcePresence<SourceMemoryMetadata>> {
    assertNode(occurrence);
    bindingKey(bindings);
    const selected = original.metadata(occurrence);
    if (selected.kind === "unavailable") return unresolved(selected.reason);
    if (selected.kind === "available") {
      const metadata = selected.value;
      if (metadata.kind === "data-layout") return resolved(Object.freeze({ kind: "present", value: metadata }));
      if (metadata.kind === "memory-layout") {
        const result = layout(metadata.identity, bindings);
        if (result.kind !== "resolved") return result;
        let value = metadataValues.get(result.value);
        if (value === undefined) {
          value = Object.freeze({ kind: "memory-layout", layout: result.value });
          metadataValues.set(result.value, value);
        }
        return resolved(Object.freeze({ kind: "present", value }));
      }
      const result = field(metadata.identity, bindings);
      if (result.kind !== "resolved") return result;
      let value = metadataValues.get(result.value);
      if (value === undefined) {
        value = Object.freeze({ kind: "memory-field", field: result.value });
        metadataValues.set(result.value, value);
      }
      return resolved(Object.freeze({ kind: "present", value }));
    }
    return resolved(none);
  }
  return Object.freeze({ context, layout, field, value });
}

export type SourceMemoryMetadataProduction = ReturnType<typeof createSourceMemoryMetadataProduction>;
