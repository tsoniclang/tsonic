import { IrExpression } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import { buildRuntimeUnionLayout } from "../../core/semantic/runtime-unions.js";
import {
  currentNarrowedType,
  isArrayLikeNarrowingCandidate,
} from "../../core/semantic/narrowing-builders.js";
import { willCarryAsRuntimeUnion } from "../../core/semantic/union-semantics.js";
import { unwrapTransparentNarrowingTarget } from "../../core/semantic/transparent-expressions.js";
import { getMemberAccessNarrowKey } from "../../core/semantic/narrowing-keys.js";
import { booleanLiteral } from "../../core/format/backend-ast/builders.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
import {
  resolveIdentifierCarrierStorageType,
  resolveDirectStorageExpressionAst,
  resolveDirectStorageExpressionType,
} from "../direct-storage-types.js";

const buildRuntimeUnionMemberCheck = (
  receiver: CSharpExpressionAst,
  memberNs: readonly number[]
): CSharpExpressionAst => {
  if (memberNs.length === 0) {
    return booleanLiteral(false);
  }

  const checks = memberNs.map<CSharpExpressionAst>((memberN) => ({
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: receiver,
      memberName: `Is${memberN}`,
    },
    arguments: [],
  }));

  return (
    checks.reduce<CSharpExpressionAst | undefined>(
      (current, check) =>
        current
          ? {
              kind: "parenthesizedExpression",
              expression: {
                kind: "binaryExpression",
                operatorToken: "||",
                left: current,
                right: check,
              },
            }
          : check,
      undefined
    ) ?? booleanLiteral(false)
  );
};

export const emitRuntimeUnionArrayIsArrayCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (expr.arguments.length !== 1) {
    return undefined;
  }
  if (expr.callee.kind !== "memberAccess" || expr.callee.isComputed) {
    return undefined;
  }
  if (expr.callee.property !== "isArray") {
    return undefined;
  }
  if (
    expr.callee.object.kind !== "identifier" ||
    expr.callee.object.name !== "Array"
  ) {
    return undefined;
  }

  const [argument] = expr.arguments;
  if (!argument || argument.kind === "spread") {
    return undefined;
  }

  const argumentType = argument.inferredType;
  if (!argumentType) {
    return undefined;
  }

  const target = unwrapTransparentNarrowingTarget(argument);
  if (target?.kind === "memberAccess" && target.isOptional) {
    return undefined;
  }
  const bindingKey =
    target?.kind === "identifier"
      ? target.name
      : target
        ? getMemberAccessNarrowKey(target)
        : undefined;
  const effectiveType =
    (bindingKey
      ? currentNarrowedType(
          bindingKey,
          target?.inferredType ?? argumentType,
          context
        )
      : undefined) ?? argumentType;

  const [argumentAst, argumentContext] = emitExpressionAst(
    target ?? argument,
    context
  );
  const directStorageType =
    target?.kind === "identifier"
      ? resolveIdentifierCarrierStorageType(target, argumentContext)
      : resolveDirectStorageExpressionType(
          target ?? argument,
          argumentAst,
          argumentContext
        );
  const runtimeCarrierAst =
    (directStorageType
      ? resolveDirectStorageExpressionAst(target ?? argument, argumentContext)
      : undefined) ?? argumentAst;
  const runtimeCarrierType = directStorageType
    ? willCarryAsRuntimeUnion(directStorageType, argumentContext)
      ? directStorageType
      : undefined
    : willCarryAsRuntimeUnion(effectiveType, argumentContext)
      ? effectiveType
      : undefined;
  if (!runtimeCarrierType) {
    return undefined;
  }

  const [runtimeLayout, layoutContext] = buildRuntimeUnionLayout(
    runtimeCarrierType,
    argumentContext,
    emitTypeAst
  );
  if (!runtimeLayout) {
    return undefined;
  }
  const runtimeMembers = runtimeLayout.members;

  const matchingMemberNs = runtimeMembers.flatMap((member, index) =>
    member && isArrayLikeNarrowingCandidate(member, layoutContext)
      ? [index + 1]
      : []
  );

  return [
    buildRuntimeUnionMemberCheck(runtimeCarrierAst, matchingMemberNs),
    argumentContext,
  ];
};
