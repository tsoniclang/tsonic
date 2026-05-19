import type { IrExpression } from "@tsonic/frontend";

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
