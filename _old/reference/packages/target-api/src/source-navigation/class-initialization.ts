import type { Node } from "@tsonic/tsts";
import type { SourceNavigationQueryContext } from "./query-context.js";
import type { SourceResult } from "../public/source/contracts.js";
import { Node_Expression, Node_Initializer } from "./ast.js";
import { AsExpressionWithTypeArguments } from "./checked-casts.js";
import { sourceClassFieldIsTypeOnly } from "./class-members.js";

export function sourceConstructionExpression(invocation: Node, source: Pick<SourceNavigationQueryContext, "ast" | "facts">,
  step: () => boolean): SourceResult<Node | undefined> {
  if (source.ast.is.IsNewExpression(invocation)) return Object.freeze({ kind: "resolved", value:
    source.facts.navigation.isProjectDeclaration(invocation) ? Node_Expression(source.ast, invocation) : undefined });
  const selected = sourceSuperConstructor(invocation, source, step);
  return selected.kind === "refused" ? selected : Object.freeze({ kind: "resolved", value: selected.value?.callee });
}

export function sourceSuperConstructor(invocation: Node, source: Pick<SourceNavigationQueryContext, "ast" | "facts">,
  step: () => boolean): SourceResult<{ readonly owner: Node; readonly callee: Node } | undefined> {
  const { ast } = source;
  const { navigation } = source.facts;
  const resolved = <Value>(value: Value): SourceResult<Value> => Object.freeze({ kind: "resolved", value });
  if (!ast.is.IsCallExpression(invocation) || ast.kindName(Node_Expression(ast, invocation)) !== "KindSuperKeyword" ||
    !navigation.isProjectDeclaration(invocation)) return resolved(undefined);
  for (let owner = ast.parent(invocation); owner !== undefined && step(); owner = ast.parent(owner)) {
    if (!ast.is.IsConstructorDeclaration(owner)) continue;
    const declaration = ast.parent(owner);
    if (declaration === undefined || !navigation.isProjectDeclaration(declaration)) return resolved(undefined);
    const heritage = navigation.declaredHeritage(declaration);
    if (heritage.kind === "refused") return heritage;
    if (heritage.value.kind !== "resolved") return resolved(undefined);
    const bases = heritage.value.edges.filter(edge => edge.kind === "extends");
    const callee = bases.length === 1 ? AsExpressionWithTypeArguments(ast, bases[0]!.heritage)?.Expression : undefined;
    return resolved(callee === undefined ? undefined : Object.freeze({ owner, callee }));
  }
  return resolved(undefined);
}

export function sourceInstanceInitializers(declaration: Node, source: Pick<SourceNavigationQueryContext, "ast" | "facts">,
  step: () => boolean): readonly Node[] | undefined {
  const { ast } = source;
  const { navigation } = source.facts;
  if (!navigation.isProjectDeclaration(declaration) ||
    !ast.is.IsClassDeclaration(declaration) && !ast.is.IsClassExpression(declaration)) return undefined;
  const initializers: Node[] = [];
  for (const member of ast.members(declaration)) {
    if (!step()) return undefined;
    if (member === undefined || !ast.is.IsPropertyDeclaration(member) || ast.hasModifierKind(member, "static") ||
      sourceClassFieldIsTypeOnly(ast, member)) continue;
    const initializer = Node_Initializer(ast, member);
    if (initializer !== undefined) initializers.push(initializer);
  }
  return Object.freeze(initializers);
}
