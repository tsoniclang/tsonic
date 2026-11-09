import type { Node } from "@tsonic/tsts";
import type { SourceInputMemoryQueries, SourceInputMemorySource } from "../host-input/memory-input.js";
import type { SourceInputComponent, SourceInputSignature } from "../host-input/identities.js";
import type { SourceApplicationFacts, SourceDescriptorView, SourceSignatureIdentity, SourceTypeBinding,
  SourceTypeComponent, SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceMemorySelection } from "../source-model/memory.js";
import type { SourceProductionResult } from "../source-model/production.js";
import type { TargetSourceProgram } from "../source-model/program.js";

export function createSourceMemoryContext(input: {
  readonly source: TargetSourceProgram;
  readonly original: SourceInputMemoryQueries;
  readonly assertNode: (node: Node) => void;
  readonly assertComponent: (component: SourceInputComponent) => void;
  readonly signature: (signature: SourceInputSignature) => SourceSignatureIdentity;
  readonly componentIdentity: (component: SourceInputComponent) => SourceTypeComponent;
  readonly equivalent: (left: SourceTypeEvidence, right: SourceTypeEvidence) => SourceProductionResult<"yes" | "no" | "deferred">;
}) {
  const { source, assertNode } = input;
  const view: SourceDescriptorView = source.facts.descriptors;
  const applications: SourceApplicationFacts = source.facts.applications;
  const identities = new WeakMap<object, number>();
  let nextIdentity = 0;
  function identity(value: object): number {
    const previous = identities.get(value);
    if (previous !== undefined) return previous;
    const selected = nextIdentity++;
    identities.set(value, selected);
    return selected;
  }
  function bindingKey(bindings: readonly SourceTypeBinding[]): string {
    const seen = new Set<Node>();
    const keys: string[] = [];
    for (const binding of bindings) {
      assertNode(binding.declaration);
      view.typeParameter(binding.declaration);
      view.assertEvidence(binding.value);
      if (seen.has(binding.declaration)) throw new Error("A memory environment requires each original binder exactly once.");
      seen.add(binding.declaration);
      keys.push(`${identity(binding.declaration)}:${identity(binding.value)}`);
    }
    return keys.join(",");
  }
  function substitute(value: SourceTypeEvidence, bindings: readonly SourceTypeBinding[]): SourceMemorySelection<SourceTypeEvidence> {
    view.assertEvidence(value);
    bindingKey(bindings);
    return view.substitute(value, bindings);
  }
  function environment(outer: readonly SourceTypeBinding[], inner: readonly SourceTypeBinding[]):
    SourceMemorySelection<readonly SourceTypeBinding[]> {
    bindingKey(outer);
    bindingKey(inner);
    const selected = new Map(outer.map(binding => [binding.declaration, binding]));
    for (const binding of inner) {
      const value = substitute(binding.value, outer);
      if (value.kind !== "resolved") return value;
      selected.set(binding.declaration, Object.freeze({ declaration: binding.declaration, value: value.value }));
    }
    return Object.freeze({ kind: "resolved", value: Object.freeze([...selected.values()]) });
  }
  function original(original: SourceInputMemorySource, bindings: readonly SourceTypeBinding[]):
    SourceMemorySelection<{ readonly value: SourceTypeEvidence; readonly typeBindings: readonly SourceTypeBinding[] }> {
    input.assertComponent(original.component);
    assertNode(original.application.invocation);
    bindingKey(bindings);
    const signature = input.signature(original.application.signature);
    const selected = applications.application(original.application.invocation);
    if (selected.kind === "refused") return selected;
    const application = selected.value;
    if (application.identity.signature !== signature || application.argumentDisposition === "skip")
      return Object.freeze({ kind: "unresolved", reason: "Memory requires the same original executed Source application as its finalized Core receipt." });
    const complete = environment(bindings, [...application.identity.classBindings, ...application.identity.signatureBindings]);
    if (complete.kind !== "resolved") return complete;
    let value: SourceTypeEvidence;
    if (original.kind === "binding") {
      assertNode(original.declaration);
      const matches = application.identity.signatureBindings.filter(binding => binding.declaration === original.declaration);
      if (matches.length !== 1)
        return Object.freeze({ kind: "unresolved", reason: "Memory requires its exact original Source signature binding." });
      value = matches[0]!.value;
    } else {
      const component = input.componentIdentity(original.component);
      if (component.root !== application.identity.invocation)
        throw new Error("Memory result components retain their exact original application root.");
      value = application.result;
      for (const selector of component.path) {
        const child = view.component(value, selector);
        if (child.kind === "refused") return child;
        value = child.value;
      }
    }
    const applied = substitute(value, bindings);
    return applied.kind !== "resolved" ? applied : Object.freeze({ kind: "resolved",
      value: Object.freeze({ value: applied.value, typeBindings: complete.value }) });
  }
  function equivalent(left: SourceTypeEvidence, right: SourceTypeEvidence): SourceMemorySelection<boolean> {
    view.assertEvidence(left);
    view.assertEvidence(right);
    const selected = input.equivalent(left, right);
    if (selected.kind === "refused") return selected;
    if (selected.kind === "pending" || selected.value === "deferred")
      return Object.freeze({ kind: "unresolved", reason: "The applied Source memory domains retain an unresolved canonical relation." });
    return Object.freeze({ kind: "resolved", value: selected.value === "yes" });
  }
  return Object.freeze({ source, original: input.original, view, assertNode, bindingKey,
    substitute, environment, component: original, equivalent });
}

export type SourceMemoryContext = ReturnType<typeof createSourceMemoryContext>;
