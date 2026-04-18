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
import {
  booleanLiteral,
  identifierType,
  nullLiteral,
} from "../../core/format/backend-ast/builders.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
import {
  resolveRuntimeCarrierExpressionAst,
  resolveRuntimeCarrierIrType,
} from "../direct-storage-types.js";

const buildRuntimeUnionMemberOrChain = (
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

const buildRuntimeUnionMemberCheck = (opts: {
  readonly receiver: CSharpExpressionAst;
  readonly memberNs: readonly number[];
  readonly context: EmitterContext;
}): [CSharpExpressionAst, EmitterContext] => {
  const { receiver, memberNs, context } = opts;

  if (memberNs.length === 0) {
    return [booleanLiteral(false), context];
  }

  return [
    {
      kind: "binaryExpression",
      operatorToken: "&&",
      left: {
        kind: "binaryExpression",
        operatorToken: "!=",
        left: {
          kind: "parenthesizedExpression",
          expression: {
            kind: "castExpression",
            type: identifierType("global::System.Object"),
            expression: {
              kind: "parenthesizedExpression",
              expression: receiver,
            },
          },
        },
        right: nullLiteral(),
      },
      right: buildRuntimeUnionMemberOrChain(receiver, memberNs),
    },
    context,
  ];
};

const buildSystemArrayCheck = (
  expression: CSharpExpressionAst
): CSharpExpressionAst => ({
  kind: "isExpression",
  expression,
  pattern: {
    kind: "typePattern",
    type: identifierType("global::System.Array"),
  },
});

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
  const runtimeCarrierAst =
    resolveRuntimeCarrierExpressionAst(target ?? argument, argumentContext) ??
    argumentAst;
  const runtimeCarrierType =
    resolveRuntimeCarrierIrType(target ?? argument, argumentContext) ??
    (willCarryAsRuntimeUnion(effectiveType, argumentContext)
      ? effectiveType
      : undefined);
  if (!runtimeCarrierType) {
    return [buildSystemArrayCheck(argumentAst), argumentContext];
  }

  const [runtimeLayout, layoutContext] = buildRuntimeUnionLayout(
    runtimeCarrierType,
    argumentContext,
    emitTypeAst
  );
  if (!runtimeLayout) {
    return [buildSystemArrayCheck(argumentAst), argumentContext];
  }
  const runtimeMembers = runtimeLayout.members;

  const matchingMemberNs = runtimeMembers.flatMap((member, index) =>
    member && isArrayLikeNarrowingCandidate(member, layoutContext)
      ? [index + 1]
      : []
  );

  return buildRuntimeUnionMemberCheck({
    receiver: runtimeCarrierAst,
    memberNs: matchingMemberNs,
    context: layoutContext,
  });
};
