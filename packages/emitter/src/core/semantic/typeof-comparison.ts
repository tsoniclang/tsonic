import type { IrExpression } from "@tsonic/frontend";
import { getMemberAccessNarrowKey } from "./narrowing-keys.js";
import { unwrapTransparentNarrowingTarget } from "./transparent-expressions.js";

export type TypeofComparison = {
  readonly target: IrExpression;
  readonly tag: string;
  readonly negate: boolean;
  readonly narrowable:
    | {
        readonly bindingKey: string;
        readonly targetExpr: Extract<
          IrExpression,
          { kind: "identifier" | "memberAccess" }
        >;
      }
    | undefined;
};

const isTypeofEqualityOperator = (
  operator: string
): operator is "===" | "==" | "!==" | "!=" =>
  operator === "===" ||
  operator === "==" ||
  operator === "!==" ||
  operator === "!=";

const tryExtractTypeofOperand = (
  left: IrExpression,
  right: IrExpression
): Pick<TypeofComparison, "target" | "tag"> | undefined => {
  if (left.kind !== "unary" || left.operator !== "typeof") {
    return undefined;
  }
  if (right.kind !== "literal" || typeof right.value !== "string") {
    return undefined;
  }
  return {
    target: left.expression,
    tag: right.value,
  };
};

const resolveNarrowableTarget = (
  target: IrExpression
): TypeofComparison["narrowable"] => {
  const transparentTarget = unwrapTransparentNarrowingTarget(target);
  if (!transparentTarget) return undefined;

  const bindingKey =
    transparentTarget.kind === "identifier"
      ? transparentTarget.name
      : getMemberAccessNarrowKey(transparentTarget);
  if (!bindingKey) return undefined;

  return {
    bindingKey,
    targetExpr: transparentTarget,
  };
};

export const tryExtractTypeofComparison = (
  expr: IrExpression
): TypeofComparison | undefined => {
  if (expr.kind !== "binary" || !isTypeofEqualityOperator(expr.operator)) {
    return undefined;
  }

  const comparison =
    tryExtractTypeofOperand(expr.left, expr.right) ??
    tryExtractTypeofOperand(expr.right, expr.left);
  if (!comparison) return undefined;

  return {
    ...comparison,
    negate: expr.operator === "!==" || expr.operator === "!=",
    narrowable: resolveNarrowableTarget(comparison.target),
  };
};
