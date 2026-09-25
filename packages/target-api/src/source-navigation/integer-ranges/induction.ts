import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceCountedLoop, SourceProgramNavigation } from "../types.js";

export function sourceIntegerInduction(
  declaration: Node,
  ast: AstReader,
  navigation: SourceProgramNavigation,
): SourceCountedLoop | undefined {
  if (!ast.is.IsVariableDeclaration(declaration) || ast.typeNode(declaration) !== undefined) return undefined;
  const list = ast.parent(declaration);
  const statement = list === undefined ? undefined : ast.parent(list);
  if (statement === undefined || !ast.is.IsForStatement(statement)) return undefined;
  const incrementor = ast.as.AsForStatement(statement)?.Incrementor;
  const loop = navigation.countedLoop(statement);
  if (loop?.counterDeclaration !== declaration || !ast.is.IsNumericLiteral(loop.start) ||
    Number(ast.text(loop.start)) !== 0) return undefined;
  const summary = navigation.declarationUseSummary(declaration);
  if (summary.captured || summary.exported || summary.memberWritten || summary.uses.length > 1024) return undefined;
  for (const use of summary.uses) {
    if (use.kind === "type-only") continue;
    let expression = use.reference;
    let parent = ast.parent(expression);
    while (parent !== undefined && ast.is.IsParenthesizedExpression(parent)) {
      expression = parent;
      parent = ast.parent(expression);
    }
    if (parent === undefined) return undefined;
    if (ast.is.IsElementAccessExpression(parent) &&
      ast.as.AsElementAccessExpression(parent)?.ArgumentExpression === expression) continue;
    if ((ast.is.IsPostfixUnaryExpression(parent) || ast.is.IsPrefixUnaryExpression(parent)) &&
      ast.operatorKindName(parent) === "KindPlusPlusToken" &&
      incrementor === parent) continue;
    if (ast.is.IsBinaryExpression(parent) && comparisons.has(ast.operatorKindName(parent) ?? "")) continue;
    return undefined;
  }
  return loop;
}

const comparisons: ReadonlySet<string> = new Set([
  "KindLessThanToken", "KindLessThanEqualsToken", "KindGreaterThanToken", "KindGreaterThanEqualsToken",
  "KindEqualsEqualsToken", "KindEqualsEqualsEqualsToken", "KindExclamationEqualsToken", "KindExclamationEqualsEqualsToken",
]);
