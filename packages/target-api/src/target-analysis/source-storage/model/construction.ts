import type { Node } from "@tsonic/tsts";
import { AsExpressionWithTypeArguments, Node_Expression, Node_Initializer, sourceClassFieldIsTypeOnly } from "../../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageUnresolved } from "./types.js";

export function sourceStorageConstructionExpression(invocation: Node, source: TargetSourceProgram,
  step: () => boolean): Node | undefined {
  return source.ast.is.IsNewExpression(invocation) ? Node_Expression(source.ast, invocation)
    : sourceStorageSuperConstructor(invocation, source, step)?.callee;
}


export function sourceStorageSuperConstructor(
  invocation: Node,
  source: TargetSourceProgram,
  step: () => boolean,
): { readonly owner: Node; readonly callee: Node } | undefined {
  const { ast, navigation } = source;
  if (!ast.is.IsCallExpression(invocation) || ast.kindName(Node_Expression(ast, invocation)) !== "KindSuperKeyword") return undefined;
  for (let owner = ast.parent(invocation); owner !== undefined && step(); owner = ast.parent(owner)) {
    if (!ast.is.IsConstructorDeclaration(owner)) continue;
    const declaration = ast.parent(owner);
    if (declaration === undefined) return undefined;
    const heritage = navigation.declaredHeritage(declaration);
    if (heritage.kind !== "resolved") return undefined;
    const bases = heritage.edges.filter(edge => edge.kind === "extends");
    const callee = bases.length === 1 ? AsExpressionWithTypeArguments(ast, bases[0]!.heritage)?.Expression : undefined;
    return callee === undefined ? undefined : Object.freeze({ owner, callee });
  }
  return undefined;
}


export function sourceStorageInstanceInitializers(declaration: Node, source: TargetSourceProgram,
  step: () => boolean): readonly Node[] {
  const initializers: Node[] = [];
  for (const member of source.ast.members(declaration)) {
    if (!step()) break;
    if (member === undefined || !source.ast.is.IsPropertyDeclaration(member) || source.ast.hasModifierKind(member, "static") ||
      sourceClassFieldIsTypeOnly(source.ast, member)) continue;
    const initializer = Node_Initializer(source.ast, member);
    if (initializer !== undefined) initializers.push(initializer);
  }
  return initializers;
}

export function sourceStorageAllocation<Bindings>(source: TargetSourceProgram, budget: SourceStorageBudget,
  invocation: Node, bindings: Bindings,
  activationFor: (owner: Node, bindings: Bindings) => SourceStorageUnresolved |
    { readonly invocation: Node; readonly callerBindings: Bindings }): SourceStorageUnresolved |
  { readonly kind: "resolved"; readonly call: Node; readonly callerBindings: Bindings } {
  return budget.withRows(temporary => {
    const seen = new Set<Bindings>();
    let call = invocation;
    let callerBindings = bindings;
    while (!source.ast.is.IsNewExpression(call)) {
      if (!budget.step()) return Object.freeze({ kind: "unresolved", reason: budget.failure()! });
      const base = sourceStorageSuperConstructor(call, source, budget.step);
      if (base === undefined || seen.has(callerBindings)) return Object.freeze({ kind: "unresolved",
        reason: "Constructor execution requires the actual checked allocation activation, not guessed heritage order." });
      if (!temporary.add(1)) return Object.freeze({ kind: "unresolved", reason: budget.failure()! });
      seen.add(callerBindings);
      const selected = activationFor(base.owner, callerBindings);
      if ("kind" in selected) return selected;
      call = selected.invocation;
      callerBindings = selected.callerBindings;
    }
    return Object.freeze({ kind: "resolved", call, callerBindings });
  });
}
