import { IrExpression, type IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import {
  buildRuntimeUnionLayout,
  buildRuntimeUnionTypeAst,
  findRuntimeUnionMemberIndices,
} from "../../core/semantic/runtime-unions.js";
import { willCarryAsRuntimeUnion } from "../../core/semantic/union-semantics.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import { identifierExpression } from "../../core/format/backend-ast/builders.js";
import {
  getTransparentComparisonTarget,
  resolveComparisonOperandType,
  widenLiteralComparisonType,
} from "./binary-helpers.js";
import {
  resolveRuntimeCarrierExpressionAst,
  resolveDirectStorageExpressionType,
  resolveIdentifierCarrierStorageType,
} from "../direct-storage-types.js";
import { stripNullish } from "../../core/semantic/type-resolution.js";

const isSupportedLiteralComparison = (
  expr: IrExpression
): expr is Extract<IrExpression, { kind: "literal" }> =>
  expr.kind === "literal" &&
  (typeof expr.value === "boolean" ||
    typeof expr.value === "string" ||
    typeof expr.value === "number");

const buildMethodInvocation = (
  receiver: CSharpExpressionAst,
  memberName: string
): CSharpExpressionAst => ({
  kind: "invocationExpression",
  expression: {
    kind: "memberAccessExpression",
    expression: receiver,
    memberName,
  },
  arguments: [],
});

const buildAnd = (
  left: CSharpExpressionAst,
  right: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "binaryExpression",
  operatorToken: "&&",
  left,
  right,
});

const buildEquality = (
  left: CSharpExpressionAst,
  right: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "binaryExpression",
  operatorToken: "==",
  left,
  right,
});

const buildUnionLiteralEquality = (opts: {
  readonly carrierAst: CSharpExpressionAst;
  readonly carrierType: IrType;
  readonly memberIndex: number;
  readonly literalAst: CSharpExpressionAst;
  readonly context: EmitterContext;
}): [CSharpExpressionAst, EmitterContext] | undefined => {
  const { carrierAst, carrierType, memberIndex, literalAst, context } = opts;
  const [layout, layoutContext] = buildRuntimeUnionLayout(
    carrierType,
    context,
    emitRuntimeTypeAst
  );
  if (!layout) {
    return undefined;
  }

  const runtimeCarrierTypeAst = buildRuntimeUnionTypeAst(layout);
  const nextId = (layoutContext.tempVarId ?? 0) + 1;
  const tempName = `__tsonic_union_compare_${nextId}`;
  const capturedCarrier: CSharpExpressionAst = {
    kind: "isExpression",
    expression: carrierAst,
    pattern: {
      kind: "declarationPattern",
      type: runtimeCarrierTypeAst,
      designation: tempName,
    },
  };
  const capturedIdentifier = identifierExpression(tempName);
  const memberCheck = buildMethodInvocation(
    capturedIdentifier,
    `Is${memberIndex + 1}`
  );
  const memberValue = buildMethodInvocation(
    capturedIdentifier,
    `As${memberIndex + 1}`
  );

  return [
    buildAnd(
      buildAnd(capturedCarrier, memberCheck),
      buildEquality(memberValue, literalAst)
    ),
    {
      ...layoutContext,
      tempVarId: nextId,
    },
  ];
};

const emitRuntimeTypeAst = (
  type: IrType,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => emitTypeAst(type, context);

export const emitRuntimeUnionLiteralComparison = (
  expr: Extract<IrExpression, { kind: "binary" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    expr.operator !== "===" &&
    expr.operator !== "!==" &&
    expr.operator !== "==" &&
    expr.operator !== "!="
  ) {
    return undefined;
  }

  const leftLiteral = isSupportedLiteralComparison(expr.left)
    ? expr.left
    : undefined;
  const rightLiteral = isSupportedLiteralComparison(expr.right)
    ? expr.right
    : undefined;

  const candidate =
    leftLiteral && !rightLiteral
      ? { unionExpr: expr.right, literalExpr: leftLiteral }
      : rightLiteral && !leftLiteral
        ? { unionExpr: expr.left, literalExpr: rightLiteral }
        : undefined;
  if (!candidate) {
    return undefined;
  }

  const unionExprType = resolveComparisonOperandType(
    candidate.unionExpr,
    context
  );
  if (!unionExprType) {
    return undefined;
  }

  const runtimeCarrierSourceType = stripNullish(unionExprType);
  if (!willCarryAsRuntimeUnion(runtimeCarrierSourceType, context)) {
    return undefined;
  }

  const literalType = widenLiteralComparisonType(
    resolveComparisonOperandType(candidate.literalExpr, context) ??
      candidate.literalExpr.inferredType
  );
  if (
    !literalType ||
    willCarryAsRuntimeUnion(stripNullish(literalType), context)
  ) {
    return undefined;
  }

  const unionTarget = getTransparentComparisonTarget(candidate.unionExpr);
  const [unionAst, unionContext] = emitExpressionAst(unionTarget, context);
  const directStorageType =
    unionTarget.kind === "identifier"
      ? resolveIdentifierCarrierStorageType(unionTarget, unionContext)
      : resolveDirectStorageExpressionType(unionTarget, unionAst, unionContext);
  const runtimeCarrierType =
    directStorageType &&
    willCarryAsRuntimeUnion(stripNullish(directStorageType), unionContext)
      ? stripNullish(directStorageType)
      : runtimeCarrierSourceType;
  const runtimeCarrierAst =
    (directStorageType
      ? resolveRuntimeCarrierExpressionAst(unionTarget, unionContext)
      : undefined) ?? unionAst;

  const [layout, layoutContext] = buildRuntimeUnionLayout(
    runtimeCarrierType,
    unionContext,
    emitRuntimeTypeAst
  );
  if (!layout) {
    return undefined;
  }

  const matchingMemberIndices = findRuntimeUnionMemberIndices(
    layout.members,
    literalType,
    layoutContext
  );
  if (matchingMemberIndices.length !== 1) {
    return undefined;
  }
  const memberIndex = matchingMemberIndices[0];
  if (memberIndex === undefined) {
    return undefined;
  }

  const [literalAst, literalContext] = emitExpressionAst(
    candidate.literalExpr,
    layoutContext,
    literalType
  );
  const equalityResult = buildUnionLiteralEquality({
    carrierAst: runtimeCarrierAst,
    carrierType: runtimeCarrierType,
    memberIndex,
    literalAst,
    context: literalContext,
  });
  if (!equalityResult) {
    return undefined;
  }
  const [equalityAst, equalityContext] = equalityResult;

  const isNegated = expr.operator === "!==" || expr.operator === "!=";
  return [
    isNegated
      ? {
          kind: "prefixUnaryExpression",
          operatorToken: "!",
          operand: {
            kind: "parenthesizedExpression",
            expression: equalityAst,
          },
        }
      : equalityAst,
    equalityContext,
  ];
};
