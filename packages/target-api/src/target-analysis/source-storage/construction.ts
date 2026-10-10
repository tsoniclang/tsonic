import type { Node } from "@tsonic/tsts";
import { Node_Expression, Node_Initializer } from "../../source-navigation/index.js";
import type { TargetSourceProgram } from "../../source-semantics/index.js";

export function sourceStorageConstructedClass(
  invocation: Node,
  source: TargetSourceProgram,
  step: () => boolean,
): Node | undefined {
  const { ast, navigation } = source;
  if (!ast.is.IsNewExpression(invocation)) return undefined;
  const visited = new Set<Node>();
  let current = Node_Expression(ast, invocation);
  while (current !== undefined && !visited.has(current) && step()) {
    visited.add(current);
    if (ast.is.IsClassExpression(current)) return navigation.isProjectDeclaration(current) ? current : undefined;
    if (ast.is.IsParenthesizedExpression(current) || ast.is.IsAsExpression(current) ||
      ast.is.IsSatisfiesExpression(current) || ast.is.IsNonNullExpression(current) || ast.is.IsTypeAssertion(current)) {
      current = Node_Expression(ast, current);
      continue;
    }
    const declaration = navigation.sourceReferenceFor(current)?.declaration;
    if (declaration === undefined) return undefined;
    if (ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration))
      return navigation.isProjectDeclaration(declaration) ? declaration : undefined;
    if (!ast.is.IsVariableDeclaration(declaration) || navigation.declarationUseSummary(declaration).bindingWritten)
      return undefined;
    current = Node_Initializer(ast, declaration);
  }
  return undefined;
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
    const callee = bases.length === 1 ? ast.as.AsExpressionWithTypeArguments(bases[0]!.heritage)?.Expression : undefined;
    return callee === undefined ? undefined : Object.freeze({ owner, callee });
  }
  return undefined;
}
