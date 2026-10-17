import type { Node, Type } from "@tsonic/tsts";
import { Node_Initializer } from "../../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import { sourceStorageInstanceInitializers } from "../model/construction.js";
import { createSourceStorageLexicalSelections } from "./lexical-regions.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageInstanceRegion } from "../model/types.js";

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
    argumentTypes?: (expression: Node) => readonly Type[] | undefined): readonly Node[] => {
    const body = ast.body(declaration);
    if (body === undefined) return [];
    const regions = [body];
    const selection = invocation === undefined ? undefined : semantics.forNode(invocation).operations.call(invocation);
    for (const [index, parameter] of ast.parameters(declaration).entries()) {
      if (!step()) break;
      const initializer = parameter === undefined ? undefined : Node_Initializer(ast, parameter);
      if (initializer === undefined) continue;
      const bindings = selection?.sourceArgumentBindings.filter(binding => binding.sourceParameterIndex === index);
      if (bindings === undefined || bindings.length === 0 || bindings.some(binding => {
        if (binding.sourceForm === "spread-sequence") return true;
        const expression = selection?.sourceArguments[binding.sourceArgumentIndex]?.expression;
        const types = argumentTypes === undefined ? [binding.selectedArgumentType]
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
