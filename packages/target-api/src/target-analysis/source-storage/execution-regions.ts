import type { Node, Type } from "@tsonic/tsts";
import { Node_Initializer, sourceClassFieldIsTypeOnly } from "../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import { sourceStorageConstructedClass } from "./construction.js";
import { createSourceStorageLexicalSelections } from "./lexical-regions.js";
import type { SourceStorageBudget } from "./resource-budget.js";

export function createSourceStorageExecutionRegions(source: TargetSourceProgram, budget: SourceStorageBudget) {
  const { ast, semantics, navigation } = source;
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
  const callable = (declaration: Node, invocation: Node | undefined): readonly Node[] => {
    const body = ast.body(declaration);
    if (body === undefined) return [];
    const regions = [body];
    const selection = invocation === undefined ? undefined : semantics.forNode(invocation).operations.call(invocation);
    for (const [index, parameter] of ast.parameters(declaration).entries()) {
      if (!step()) break;
      const initializer = parameter === undefined ? undefined : Node_Initializer(ast, parameter);
      if (initializer === undefined) continue;
      const bindings = selection?.sourceArgumentBindings.filter(binding => binding.sourceParameterIndex === index);
      if (bindings === undefined || bindings.length === 0 || bindings.some(binding =>
        binding.sourceForm === "spread-sequence" || typeMayBeAbsent(binding.selectedArgumentType, invocation!))) {
        regions.push(initializer);
      }
    }
    return regions;
  };
  const instance = (invocation: Node): readonly { readonly owner: Node; readonly node: Node }[] => {
    const declaration = sourceStorageConstructedClass(invocation, source, step);
    if (declaration === undefined || !ast.is.IsClassDeclaration(declaration) && !ast.is.IsClassExpression(declaration)) return [];
    const classes = [declaration];
    const checked = new Set<Node>();
    const regions: { readonly owner: Node; readonly node: Node }[] = [];
    while (classes.length !== 0) {
      const selected = classes.pop()!;
      if (checked.has(selected)) continue;
      checked.add(selected);
      if (!step()) break;
      if (!ast.is.IsClassDeclaration(selected) && !ast.is.IsClassExpression(selected)) continue;
      for (const member of ast.members(selected)) {
        if (!step()) break;
        if (member === undefined || !ast.is.IsPropertyDeclaration(member) ||
          ast.hasModifierKind(member, "static") || sourceClassFieldIsTypeOnly(ast, member)) continue;
        const initializer = Node_Initializer(ast, member);
        if (initializer !== undefined) regions.push({ owner: selected, node: initializer });
      }
      const heritage = navigation.declaredHeritage(selected);
      if (heritage.kind === "resolved") {
        for (const edge of heritage.edges) if (edge.kind === "extends") classes.push(edge.target.declaration);
      }
    }
    return regions;
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
