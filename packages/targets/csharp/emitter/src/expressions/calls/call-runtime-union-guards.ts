import { IrExpression } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeAst } from "../../type-emitter.js";
import { buildRuntimeUnionLayout } from "../../core/semantic/runtime-unions.js";
import { currentNarrowedType } from "../../core/semantic/narrowing-builders.js";
import { willCarryAsRuntimeUnion } from "../../core/semantic/union-semantics.js";
import { unwrapTransparentNarrowingTarget } from "../../core/semantic/transparent-expressions.js";
import { getMemberAccessNarrowKey } from "../../core/semantic/narrowing-keys.js";
import {
  booleanLiteral,
  identifierType,
} from "../../core/format/backend-ast/builders.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
import {
  resolveRuntimeCarrierExpressionAst,
  resolveRuntimeCarrierIrType,
} from "../direct-storage-types.js";
import {
  buildRuntimeArrayShapeCondition,
  isArrayLikeNarrowingCandidate,
} from "../../core/semantic/array-shape-narrowing.js";

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
  const recursiveCondition = buildRuntimeArrayShapeCondition(
    runtimeCarrierAst,
    runtimeCarrierType,
    layoutContext,
    emitTypeAst
  );
  if (recursiveCondition?.hasNestedPath) {
    return [recursiveCondition.condition, recursiveCondition.context];
  }

  return matchingMemberNs.length === 0
    ? [booleanLiteral(false), layoutContext]
    : [
        recursiveCondition?.condition ?? booleanLiteral(false),
        recursiveCondition?.context ?? layoutContext,
      ];
};
