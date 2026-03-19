/**
 * Extension method call emission.
 *
 * Handles both fluent extension calls (receiver.Method(args)) and
 * explicit static extension calls (Type.Method(receiver, args)).
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import {
  emitTypeArgumentsAst,
  generateSpecializedName,
} from "../identifiers.js";
import { emitTypeAst } from "../../type-emitter.js";
import {
  shouldEmitFluentExtensionCall,
  getTypeNamespace,
  needsIntCast,
  isInstanceMemberAccess,
} from "./call-analysis.js";
import { sameTypeAstSurface } from "../../core/format/backend-ast/utils.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import { identifierExpression } from "../../core/format/backend-ast/builders.js";
import {
  resolveRecoveredReceiverBinding,
  isPrimitiveReceiverExtensionCall,
} from "./call-binding-resolution.js";
import {
  shouldPreferNativeArrayWrapperInterop,
  shouldNormalizeArrayLikeInteropResult,
} from "./call-array-interop.js";
import { emitCallArguments, wrapIntCast } from "./call-arguments.js";

const preserveReceiverTypeAssertionAst = (
  receiverExpr: IrExpression,
  receiverAst: CSharpExpressionAst,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (receiverExpr.kind !== "typeAssertion") {
    return [receiverAst, context];
  }

  const [targetTypeAst, nextContext] = emitTypeAst(
    receiverExpr.targetType,
    context
  );

  if (
    receiverAst.kind === "castExpression" &&
    sameTypeAstSurface(receiverAst.type, targetTypeAst)
  ) {
    return [receiverAst, nextContext];
  }

  return [
    {
      kind: "parenthesizedExpression",
      expression: {
        kind: "castExpression",
        type: targetTypeAst,
        expression: receiverAst,
      },
    },
    nextContext,
  ];
};

/**
 * Try to emit an extension method call. Returns undefined if the call
 * is not an extension method invocation.
 */
export const tryEmitExtensionMethodCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (expr.callee.kind !== "memberAccess") return undefined;

  const recoveredReceiverBinding = resolveRecoveredReceiverBinding(
    expr,
    context
  );

  const binding = expr.callee.memberBinding ?? recoveredReceiverBinding;
  if (!binding?.isExtensionMethod) return undefined;
  if (!isInstanceMemberAccess(expr.callee, context)) return undefined;
  if (
    shouldPreferNativeArrayWrapperInterop(
      binding,
      expr.callee.object.inferredType,
      context
    )
  ) {
    return undefined;
  }

  let currentContext = context;

  const receiverExpr = expr.callee.object;
  const receiverType =
    resolveEffectiveExpressionType(receiverExpr, currentContext) ??
    receiverExpr.inferredType;

  const [rawReceiverAst, receiverContext] = emitExpressionAst(
    receiverExpr,
    currentContext
  );
  const [receiverAst, preservedReceiverContext] =
    preserveReceiverTypeAssertionAst(
      receiverExpr,
      rawReceiverAst,
      receiverContext
    );
  currentContext = preservedReceiverContext;

  // Fluent extension method path
  if (
    shouldEmitFluentExtensionCall(binding) &&
    !isPrimitiveReceiverExtensionCall(receiverType, currentContext)
  ) {
    const ns = getTypeNamespace(binding.type);
    if (ns) {
      currentContext.usings.add(ns);
    }

    let typeArgAsts: readonly CSharpTypeAst[] = [];
    if (expr.typeArguments && expr.typeArguments.length > 0) {
      const [typeArgs, typeContext] = emitTypeArgumentsAst(
        expr.typeArguments,
        currentContext
      );
      typeArgAsts = typeArgs;
      currentContext = typeContext;
    }

    const [argAsts, argContext] = emitCallArguments(
      expr.arguments,
      expr,
      currentContext
    );
    currentContext = argContext;

    const memberAccess: CSharpExpressionAst = expr.isOptional
      ? {
          kind: "conditionalMemberAccessExpression",
          expression: receiverAst,
          memberName: binding.member,
        }
      : {
          kind: "memberAccessExpression",
          expression: receiverAst,
          memberName: binding.member,
        };

    const invocation: CSharpExpressionAst = {
      kind: "invocationExpression",
      expression: memberAccess,
      arguments: argAsts,
      typeArguments: typeArgAsts.length > 0 ? typeArgAsts : undefined,
    };

    const callAst: CSharpExpressionAst = shouldNormalizeArrayLikeInteropResult(
      expr.inferredType,
      expectedType
    )
      ? {
          kind: "invocationExpression",
          expression: identifierExpression(
            "global::System.Linq.Enumerable.ToArray"
          ),
          arguments: [invocation],
        }
      : invocation;

    return [
      wrapIntCast(needsIntCast(expr, binding.member), callAst),
      currentContext,
    ];
  }

  let finalCalleeName = `global::${binding.type}.${binding.member}`;

  let typeArgAsts: readonly CSharpTypeAst[] = [];
  if (expr.typeArguments && expr.typeArguments.length > 0) {
    if (expr.requiresSpecialization) {
      const [specializedName, specContext] = generateSpecializedName(
        finalCalleeName,
        expr.typeArguments,
        currentContext
      );
      finalCalleeName = specializedName;
      currentContext = specContext;
    } else {
      const [typeArgs, typeContext] = emitTypeArgumentsAst(
        expr.typeArguments,
        currentContext
      );
      typeArgAsts = typeArgs;
      currentContext = typeContext;
    }
  }

  const [argAsts, argContext] = emitCallArguments(
    expr.arguments,
    expr,
    currentContext
  );
  currentContext = argContext;

  // Prepend receiver as first argument (static extension call)
  const allArgAsts: readonly CSharpExpressionAst[] = [receiverAst, ...argAsts];

  const invocation: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: identifierExpression(finalCalleeName),
    arguments: allArgAsts,
    typeArguments: typeArgAsts.length > 0 ? typeArgAsts : undefined,
  };

  // Wrap in ToArray() if result type is array
  const callAst: CSharpExpressionAst = shouldNormalizeArrayLikeInteropResult(
    expr.inferredType,
    expectedType
  )
    ? {
        kind: "invocationExpression",
        expression: identifierExpression(
          "global::System.Linq.Enumerable.ToArray"
        ),
        arguments: [invocation],
      }
    : invocation;

  return [
    wrapIntCast(needsIntCast(expr, finalCalleeName), callAst),
    currentContext,
  ];
};
