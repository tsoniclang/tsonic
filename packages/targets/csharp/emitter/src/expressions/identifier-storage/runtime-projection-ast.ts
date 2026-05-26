import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";

export const isRuntimeUnionProjectionAst = (
  exprAst: CSharpExpressionAst
): boolean => {
  const directAst =
    exprAst.kind === "parenthesizedExpression" ? exprAst.expression : exprAst;
  return (
    directAst.kind === "invocationExpression" &&
    directAst.arguments.length === 0 &&
    directAst.expression.kind === "memberAccessExpression" &&
    /^As\d+$/.test(directAst.expression.memberName)
  );
};
