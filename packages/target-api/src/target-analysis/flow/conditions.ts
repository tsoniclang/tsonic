import type { Node } from "@tsonic/tsts";
import type { SourceFlowConstruction } from "./construction.js";
import { sourceFlowUnwrap } from "./syntax.js";

export function sourceFlowBooleanEdges(build: SourceFlowConstruction, point: number, condition: Node,
  whenTrue: number, whenFalse: number): void {
  const kind = build.source.ast.kindName(sourceFlowUnwrap(build, condition));
  if (kind !== "KindFalseKeyword") build.edge(point, whenTrue, "true");
  if (kind !== "KindTrueKeyword") build.edge(point, whenFalse, "false");
}

export function sourceFlowNullishEdges(build: SourceFlowConstruction, point: number, condition: Node,
  nullish: number, present: number): void {
  const operand = sourceFlowUnwrap(build, condition);
  const { ast } = build.source;
  const kind = ast.kindName(operand);
  const absent = kind === "KindNullKeyword" || ast.is.IsVoidExpression(operand);
  const nonNullish = ast.is.IsNumericLiteral(operand) || ast.is.IsBigIntLiteral(operand) || ast.is.IsStringLiteral(operand) ||
    ast.is.IsArrayLiteralExpression(operand) || ast.is.IsObjectLiteralExpression(operand) ||
    kind === "KindTrueKeyword" || kind === "KindFalseKeyword" || kind === "KindNoSubstitutionTemplateLiteral";
  if (!nonNullish) build.edge(point, nullish, "nullish");
  if (!absent) build.edge(point, present, "present");
}
