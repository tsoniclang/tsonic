import type { IrExpression } from "@tsonic/frontend";

const sameSourceSpan = (
  left: IrExpression | undefined,
  right: IrExpression | undefined
): boolean => {
  if (!left?.sourceSpan || !right?.sourceSpan) {
    return false;
  }

  return (
    left.sourceSpan.file === right.sourceSpan.file &&
    left.sourceSpan.line === right.sourceSpan.line &&
    left.sourceSpan.column === right.sourceSpan.column &&
    left.sourceSpan.length === right.sourceSpan.length
  );
};

export const isCompilerTransparentTypeAssertion = (
  expr: IrExpression
): expr is Extract<IrExpression, { kind: "typeAssertion" }> =>
  expr.kind === "typeAssertion" &&
  (expr.expression.kind === "identifier" ||
    expr.expression.kind === "memberAccess") &&
  sameSourceSpan(expr, expr.expression);

export const unwrapTransparentExpression = (
  expr: IrExpression
): IrExpression => {
  switch (expr.kind) {
    case "typeAssertion":
    case "numericNarrowing":
    case "asinterface":
    case "trycast":
      return unwrapTransparentExpression(expr.expression);
    default:
      return expr;
  }
};

export const unwrapTransparentNarrowingTarget = (
  expr: IrExpression
):
  | Extract<IrExpression, { kind: "identifier" | "memberAccess" }>
  | undefined => {
  const unwrapped = unwrapTransparentExpression(expr);
  return unwrapped.kind === "identifier" || unwrapped.kind === "memberAccess"
    ? unwrapped
    : undefined;
};
