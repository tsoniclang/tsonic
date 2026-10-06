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
