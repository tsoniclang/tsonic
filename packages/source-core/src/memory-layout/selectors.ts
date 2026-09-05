import type { Node } from "@tsonic/tsts";
import type { TsonicSourceFileAnalysisContext } from "../analysis/context.js";

export function isMemoryFieldSelector(node: Node, context: TsonicSourceFileAnalysisContext): boolean {
  const { ast } = context;
  if ((!ast.is.IsArrowFunction(node) && !ast.is.IsFunctionExpression(node)) ||
      ast.hasModifierKind(node, "async") ||
      (ast.is.IsFunctionExpression(node) && ast.as.AsFunctionExpression(node)?.AsteriskToken !== undefined)) return false;
  const parameters = ast.parameters(node);
  const parameter = parameters[0];
  if (parameters.length !== 1 || parameter === undefined ||
      !ast.is.IsIdentifier(ast.name(parameter)) ||
      ast.as.AsParameterDeclaration(parameter)?.Initializer !== undefined ||
      ast.as.AsParameterDeclaration(parameter)?.DotDotDotToken !== undefined) return false;
  const body = ast.body(node);
  if (body === undefined) return false;
  if (!ast.is.IsBlock(body)) return true;
  const statements = ast.statements(body);
  return statements.length === 1 && ast.is.IsReturnStatement(statements[0]);
}
