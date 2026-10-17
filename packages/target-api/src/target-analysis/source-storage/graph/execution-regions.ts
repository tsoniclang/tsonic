import type { Node, Type } from "@tsonic/tsts";
import { Node_Initializer } from "../../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import { sourceStorageInstanceInitializers } from "../model/construction.js";
import { createSourceStorageLexicalSelections } from "./lexical-regions.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageInstanceRegion, SourceStorageCallbackEntry } from "../model/types.js";
import { sourceStorageCallableInputSlots, sourceStorageNativeInputSlots } from "./invocation-inputs.js";

export function createSourceStorageExecutionRegions(source: TargetSourceProgram, budget: SourceStorageBudget,
  constructionLineages: (invocation: Node) => readonly {
    readonly classes: readonly { readonly subject: SourceStorageSubject }[]; readonly complete: boolean;
  }[] | undefined) {
  const { ast, semantics } = source;
  const step = budget.step;
  const lexical = createSourceStorageLexicalSelections(ast, budget);
  const invocations = new Map<Node, Set<Node>>();
  const invocationRows = budget.createRows();
  let sealed = false;
  const typeMayBeAbsent = (type: Type, owner: Node): boolean => {
    const types = semantics.forNode(owner).types;
    if (!step()) return true;
    if (types.isAny(type) || types.isUnknown(type) || types.isNullish(type) || types.isVoidLike(type)) return true;
    const present = types.nonNullableType(type);
    return present === undefined || !types.isIdentical(type, present);
  };
  const callable = (declaration: Node, invocation: Node | undefined,
    argumentTypes?: (expression: Node) => readonly Type[] | undefined, callback?: SourceStorageCallbackEntry): readonly Node[] => {
    const body = ast.body(declaration);
    if (body === undefined) return [];
    const regions = [body];
    const consumer = semantics.forNode(invocation ?? declaration);
    const selection = invocation === undefined ? undefined : consumer.operations.call(invocation);
    const slots = sourceStorageCallableInputSlots(source, declaration, consumer,
      { kind: "source-implementation", signature: callback === undefined ? selection?.selectedSignature : undefined }, step);
    for (const parameter of ast.parameters(declaration)) {
      if (!step()) break;
      const file = parameter === undefined ? undefined : ast.getSourceFile(parameter);
      if (parameter === undefined || file === undefined || !semantics.includes(file) ||
        !ast.is.IsParameterDeclaration(parameter) || ast.parent(parameter) !== declaration) {
        budget.reject("Source storage callable inputs require exact checked parameter declaration ownership.");
        break;
      }
      const initializer = Node_Initializer(ast, parameter);
      if (initializer === undefined) continue;
      if (callback !== undefined && invocation !== undefined) {
        const inputs = sourceStorageNativeInputSlots(source, declaration,
          { node: parameter, kind: "input", projection: [] }, callback.argument.binding.selectedParameterType, consumer, step);
        if (inputs === undefined || inputs.some(input => input.absent || input.acceptsOmission || input.type === undefined ||
          typeMayBeAbsent(input.type, invocation))) regions.push(initializer);
        continue;
      }
      const inputs = slots?.filter(slot => slot.parameter === parameter);
      const bindings = inputs === undefined ? undefined : selection?.sourceArgumentBindings.filter(binding =>
        inputs.some(slot => slot.effectiveIndex === binding.effectiveArgumentIndex || slot.repeated && binding.effectiveArgumentIndex >= slot.effectiveIndex));
      if (bindings === undefined || bindings.length === 0 || bindings.some(binding => {
        if (binding.sourceForm === "spread-sequence") return true;
        const expression = selection?.sourceArguments[binding.sourceArgumentIndex]?.expression;
        const types = argumentTypes === undefined || binding.sourceForm === "spread-element" ? [binding.selectedArgumentType]
          : expression === undefined ? undefined : argumentTypes(expression);
        return types === undefined || types.length === 0 || types.some(type => typeMayBeAbsent(type, invocation!));
      })) {
        regions.push(initializer);
      }
    }
    return regions;
  };
  const instance = (invocation: Node): { readonly regions: readonly SourceStorageInstanceRegion[]; readonly exact: boolean } | undefined => {
    const lineages = constructionLineages(invocation);
    if (lineages === undefined) return undefined;
    const checked = new Set<Node>();
    const regions: SourceStorageInstanceRegion[] = [];
    for (const lineage of lineages) for (const selected of lineage.classes) {
      if (!step()) return undefined;
      const owner = selected.subject.node;
      if (checked.has(owner)) continue;
      checked.add(owner);
      for (const initializer of sourceStorageInstanceInitializers(owner, source, step)) regions.push(Object.freeze({ owner, node: initializer }));
    }
    return Object.freeze({ regions: Object.freeze(regions), exact: lineages.length !== 0 && lineages.every(lineage => lineage.complete) });
  };
  return Object.freeze({ callable, instance, ...lexical,
    recordInvocation(invocation: Node): void {
      if (sealed) {
        budget.reject("Source storage execution regions cannot register invocations after construction is sealed.");
        return;
      }
      if (!step()) return;
      const region = lexical.enclosing(invocation);
      if (budget.failure() !== undefined) return;
      if (region === undefined) {
        budget.reject("Source storage execution requires its exact checked invocation region.");
        return;
      }
      const selected = invocations.get(region);
      if (selected?.has(invocation) || !invocationRows.add(selected === undefined ? 2 : 1)) return;
      const retained = selected ?? new Set<Node>();
      retained.add(invocation);
      invocations.set(region, retained);
    },
    invocationsIn(region: Node): Iterable<Node> | undefined {
      if (!step()) return undefined;
      return invocations.get(region)?.values();
    },
    seal(): void { sealed = true; },
  });
}
