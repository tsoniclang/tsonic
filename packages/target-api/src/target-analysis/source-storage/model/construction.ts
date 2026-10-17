import type { Node } from "@tsonic/tsts";
import { AsExpressionWithTypeArguments, Node_Expression, Node_Initializer, sourceClassFieldIsTypeOnly } from "../../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import type { SourceStorageBudget } from "./resource-budget.js";
import type { SourceStorageUnresolved } from "./types.js";
import type { SourceStorageSubject } from "./subjects.js";

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

export function sourceStorageAllocations<Bindings>(source: TargetSourceProgram, budget: SourceStorageBudget,
  invocation: Node, bindings: Bindings,
  receiverOriginsFor: (owner: Node, bindings: Bindings) => SourceStorageUnresolved |
    readonly { readonly subject: SourceStorageSubject; readonly bindings: Bindings }[]): SourceStorageUnresolved |
  { readonly kind: "resolved"; readonly allocations: readonly { readonly call: Node; readonly callerBindings: Bindings }[] } {
  return budget.withRows(temporary => {
    if (source.ast.is.IsNewExpression(invocation)) return Object.freeze({ kind: "resolved",
      allocations: Object.freeze([Object.freeze({ call: invocation, callerBindings: bindings })]) });
    const base = sourceStorageSuperConstructor(invocation, source, budget.step);
    if (base === undefined) return Object.freeze({ kind: "unresolved",
      reason: "Constructor execution requires its actual checked allocation receiver, not guessed heritage order." });
    const selected = receiverOriginsFor(base.owner, bindings);
    if ("kind" in selected) return selected;
    const allocations: { readonly call: Node; readonly callerBindings: Bindings }[] = [];
    const seen = new Map<Node, Set<Bindings>>();
    for (const origin of selected) {
      if (!budget.step()) return Object.freeze({ kind: "unresolved", reason: budget.failure()! });
      if (origin.subject.kind !== "value" || origin.subject.projection.length !== 0 || !source.ast.is.IsNewExpression(origin.subject.node))
        return Object.freeze({ kind: "unresolved", reason: "Constructor execution requires every actual receiver origin to identify its checked allocation." });
      const previous = seen.get(origin.subject.node);
      if (previous?.has(origin.bindings)) continue;
      if (!temporary.add(previous === undefined ? 3 : 2)) return Object.freeze({ kind: "unresolved", reason: budget.failure()! });
      const contexts = previous ?? new Set<Bindings>();
      contexts.add(origin.bindings);
      seen.set(origin.subject.node, contexts);
      allocations.push(Object.freeze({ call: origin.subject.node, callerBindings: origin.bindings }));
    }
    return allocations.length === 0 ? Object.freeze({ kind: "unresolved",
      reason: "Constructor execution has no completed actual allocation receiver." })
      : Object.freeze({ kind: "resolved", allocations: Object.freeze(allocations) });
  });
}
