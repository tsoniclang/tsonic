import type { AstReader, Node } from "@tsonic/tsts";

export function pointerFlowOperand(ast: AstReader, node: Node): Node | undefined {
  if (ast.is.IsParenthesizedExpression(node)) return ast.as.AsParenthesizedExpression(node)?.Expression;
  if (ast.is.IsAsExpression(node)) return ast.as.AsAsExpression(node)?.Expression;
  if (ast.is.IsTypeAssertion(node)) return ast.as.AsTypeAssertion(node)?.Expression;
  if (ast.is.IsNonNullExpression(node)) return ast.as.AsNonNullExpression(node)?.Expression;
  if (ast.is.IsSatisfiesExpression(node)) return ast.as.AsSatisfiesExpression(node)?.Expression;
  return undefined;
}

export function pointerFlowParent(ast: AstReader, node: Node): { readonly value: Node; readonly parent?: Node } {
  let value = node;
  for (;;) {
    const parent = ast.parent(value);
    if (parent === undefined || pointerFlowOperand(ast, parent) !== value) return { value, parent };
    value = parent;
  }
}

export function pointerFlowCallableBoundary(ast: AstReader, node: Node): boolean {
  return ast.is.IsFunctionDeclaration(node) || ast.is.IsFunctionExpression(node) ||
    ast.is.IsArrowFunction(node) || ast.is.IsMethodDeclaration(node) ||
    ast.is.IsGetAccessorDeclaration(node) || ast.is.IsSetAccessorDeclaration(node) ||
    ast.is.IsConstructorDeclaration(node) || ast.is.IsClassDeclaration(node) || ast.is.IsClassExpression(node);
}
