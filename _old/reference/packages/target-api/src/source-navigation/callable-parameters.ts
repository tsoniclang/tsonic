import type { Node } from "@tsonic/tsts";
import type { SourceApplication, SourcePresence, SourceResult, SourceTypeDescriptorSignature, SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceNavigationQueryContext } from "./query-context.js";
import { failTargetCompilerResourceLimit } from "../artifacts.js";

export function sourceCallableSignatures(source: Pick<SourceNavigationQueryContext, "facts">, value: SourceTypeEvidence,
  visit: (original: Node) => void): SourceResult<readonly {
    readonly value: SourceTypeEvidence; readonly signature: SourceTypeDescriptorSignature;
  }[]> {
  const view = source.facts.descriptors;
  view.assertEvidence(value);
  const pending = [value];
  const visited = new Set<SourceTypeEvidence>();
  const selected: { readonly value: SourceTypeEvidence; readonly signature: SourceTypeDescriptorSignature }[] = [];
  while (pending.length !== 0) {
    const current = pending.pop()!;
    view.assertEvidence(current);
    visit(current.component.root);
    if (visited.has(current)) continue;
    if (visited.size >= 1_048_576)
      failTargetCompilerResourceLimit("tsonic", "Source callable signature inventory", "components", 1_048_576, value.component.root);
    visited.add(current);
    if (current.sum !== undefined) pending.push(...current.sum.arms);
    else if (current.type.kind === "optional" || current.type.kind === "intersection") {
      const child = view.component(current, { kind: current.type.kind === "optional" ? "optional-value" : "intersection-result" });
      if (child.kind === "refused") return child;
      pending.push(child.value);
    } else if (current.type.kind === "declared") {
      const definition = view.definition(current);
      if (definition.kind === "refused") return definition;
      if (definition.value !== current) pending.push(definition.value);
    } else if (current.type.kind === "shape" || current.type.kind === "callable") {
      for (const signature of [...current.type.calls, ...current.type.constructs]) {
        visit(current.component.root);
        selected.push(Object.freeze({ value: current, signature }));
      }
    }
  }
  return Object.freeze({ kind: "resolved", value: Object.freeze(selected) });
}

export function sourceCallableValueParameters(source: SourceNavigationQueryContext, declaration: Node,
  application: SourceApplication | undefined): SourceResult<SourcePresence<readonly Node[]>> {
  const { ast } = source;
  const navigation = source.facts.navigation;
  if (!navigation.includes(declaration)) throw new Error("Source callable parameters require their original declaration.");
  const none = Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "none" }) } as const);
  let value: SourceTypeEvidence;
  if (application !== undefined) {
    const original = source.facts.applications.application(application.identity.invocation);
    if (original.kind === "refused") return original;
    if (original.value !== application) throw new Error("Selected callable parameters require their exact original application.");
    value = application.callee.value;
  } else {
    if (!navigation.callableRoles(declaration).signature) return none;
    const slot = source.facts.values.declaredSlot(declaration);
    if (slot.kind === "refused") return slot;
    value = slot.value.type;
  }
  const inventory = sourceCallableSignatures(source, value, () => {});
  if (inventory.kind === "refused") return inventory;
  const selected = inventory.value.filter(original => application === undefined
    ? original.signature.identity.declaration === declaration : original.signature.identity === application.identity.signature);
  if (selected.length !== 1) return none;
  const parameters: Node[] = [];
  const seen = new Set<Node>();
  for (const original of selected[0]!.signature.parameters) {
    const parameter = original.declaration;
    if (parameter === undefined || !ast.is.IsParameterDeclaration(parameter) || seen.has(parameter)) return none;
    if (!navigation.includes(parameter)) throw new Error("A callable parameter requires its exact original identity.");
    seen.add(parameter);
    parameters.push(parameter);
  }
  return Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "present", value: Object.freeze(parameters) }) });
}
