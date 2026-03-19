/**
 * Call expression emitter — main dispatch and orchestration.
 *
 * Routes call expressions to specialized emitters (promise, array interop,
 * dynamic import, JSON, extension methods) and handles the default regular-call path.
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import {
  emitTypeArgumentsAst,
  generateSpecializedName,
} from "../identifiers.js";
import { emitTypeAst } from "../../type-emitter.js";
import { emitMemberAccess } from "../access.js";
import {
  isJsonSerializerCall,
  isGlobalJsonCall,
  isInstanceMemberAccess,
  shouldEmitFluentExtensionCall,
  getTypeNamespace,
  needsIntCast,
} from "./call-analysis.js";
import {
  extractCalleeNameFromAst,
  sameTypeAstSurface,
} from "../../core/format/backend-ast/utils.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import { identifierExpression } from "../../core/format/backend-ast/builders.js";

// Import from split modules
import {
  resolveRecoveredReceiverBinding,
  isPrimitiveReceiverExtensionCall,
} from "./call-binding-resolution.js";
import { emitDynamicImportCall } from "./call-dynamic-import.js";
import {
  emitJsonSerializerCall,
  emitGlobalJsonCall,
  getRuntimeObjectHelperParameterOverrides,
} from "./call-json.js";
import {
  emitPromiseStaticCall,
  emitPromiseThenCatchFinally,
} from "./call-promise.js";
import {
  emitArrayMutationInteropCall,
  emitArrayWrapperInteropCall,
  shouldPreferNativeArrayWrapperInterop,
  shouldNormalizeArrayLikeInteropResult,
  shouldNormalizeUnboundJsArrayWrapperResult,
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

const buildCallTargetExpectedType = (
  expr: Extract<IrExpression, { kind: "call" }>
): IrType | undefined => {
  const calleeType = expr.callee.inferredType;
  if (calleeType?.kind === "functionType") {
    return calleeType;
  }

  const parameterTypes = expr.surfaceParameterTypes ?? expr.parameterTypes;
  const restParameter = expr.surfaceRestParameter ?? expr.restParameter;

  if (!parameterTypes || !expr.inferredType) {
    return undefined;
  }

  return {
    kind: "functionType",
    parameters: parameterTypes.map((parameterType, index) => ({
      kind: "parameter",
      pattern: {
        kind: "identifierPattern",
        name: `__tsonic_arg_${index}`,
      },
      type:
        restParameter && restParameter.index === index
          ? (restParameter.arrayType ?? parameterType)
          : parameterType,
      initializer: undefined,
      isOptional: false,
      isRest: restParameter?.index === index,
      passing: expr.argumentPassing?.[index] ?? "value",
    })),
    returnType: expr.inferredType,
  };
};

const extractTransparentIdentifier = (
  expr: IrExpression
): Extract<IrExpression, { kind: "identifier" }> | undefined => {
  let current: IrExpression = expr;

  while (
    current.kind === "typeAssertion" ||
    current.kind === "numericNarrowing"
  ) {
    current = current.expression;
  }

  return current.kind === "identifier" ? current : undefined;
};

/**
 * Emit a function call expression as CSharpExpressionAst
 */
export const emitCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const recoveredReceiverBinding = resolveRecoveredReceiverBinding(
    expr,
    context
  );

  const dynamicImport = emitDynamicImportCall(expr, context);
  if (dynamicImport) return dynamicImport;

  const promiseStaticCall = emitPromiseStaticCall(expr, context);
  if (promiseStaticCall) return promiseStaticCall;

  const promiseChain = emitPromiseThenCatchFinally(expr, context);
  if (promiseChain) return promiseChain;

  // Void promise resolve: emit as zero-arg call when safe.
  const transparentCalleeIdentifier = extractTransparentIdentifier(expr.callee);
  if (
    transparentCalleeIdentifier &&
    context.voidResolveNames?.has(transparentCalleeIdentifier.name)
  ) {
    const isZeroArg = expr.arguments.length === 0;
    const isSingleUndefined =
      expr.arguments.length === 1 &&
      expr.arguments[0]?.kind === "identifier" &&
      expr.arguments[0].name === "undefined";

    if (isZeroArg || isSingleUndefined) {
      const [calleeAst, calleeCtx] = emitExpressionAst(
        transparentCalleeIdentifier,
        context
      );
      return [
        {
          kind: "invocationExpression",
          expression: calleeAst,
          arguments: [],
        },
        calleeCtx,
      ];
    }
  }

  // Check for JsonSerializer calls (NativeAOT support)
  const jsonCall = isJsonSerializerCall(expr.callee);
  if (jsonCall) {
    return emitJsonSerializerCall(expr, context, jsonCall.method);
  }

  // Check for global JSON.stringify/parse calls
  const globalJsonCall = isGlobalJsonCall(expr.callee);
  if (globalJsonCall) {
    return emitGlobalJsonCall(expr, context, globalJsonCall.method);
  }

  // EF Core query canonicalization: ToList().ToArray() → ToArray()
  if (
    expr.callee.kind === "memberAccess" &&
    expr.callee.property === "ToArray" &&
    expr.arguments.length === 0 &&
    expr.callee.object.kind === "call"
  ) {
    const innerCall = expr.callee.object;

    if (
      innerCall.callee.kind === "memberAccess" &&
      innerCall.callee.memberBinding?.isExtensionMethod &&
      isInstanceMemberAccess(innerCall.callee, context) &&
      innerCall.callee.memberBinding.type.startsWith(
        "System.Linq.Enumerable"
      ) &&
      innerCall.callee.memberBinding.member === "ToList" &&
      innerCall.arguments.length === 0
    ) {
      let currentContext = context;

      currentContext.usings.add("System.Linq");

      const receiverExpr = innerCall.callee.object;
      const [receiverAst, receiverCtx] = emitExpressionAst(
        receiverExpr,
        currentContext
      );
      currentContext = receiverCtx;

      return [
        {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: receiverAst,
            memberName: "ToArray",
          },
          arguments: [],
        },
        currentContext,
      ];
    }
  }

  // Extension method lowering: emit explicit static invocation with receiver as first arg.
  if (
    expr.callee.kind === "memberAccess" &&
    (expr.callee.memberBinding ?? recoveredReceiverBinding)
      ?.isExtensionMethod &&
    isInstanceMemberAccess(expr.callee, context) &&
    !shouldPreferNativeArrayWrapperInterop(
      expr.callee.memberBinding ?? recoveredReceiverBinding,
      expr.callee.object.inferredType,
      context
    )
  ) {
    let currentContext = context;

    const binding = expr.callee.memberBinding ?? recoveredReceiverBinding;
    if (!binding) {
      throw new Error("ICE: expected recovered extension binding");
    }
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

      const callAst: CSharpExpressionAst =
        shouldNormalizeArrayLikeInteropResult(expr.inferredType, expectedType)
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
    const allArgAsts: readonly CSharpExpressionAst[] = [
      receiverAst,
      ...argAsts,
    ];

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
  }

  const arrayWrapperInteropCall = emitArrayWrapperInteropCall(
    expr,
    context,
    expectedType
  );
  const arrayMutationInteropCall = emitArrayMutationInteropCall(expr, context);
  if (arrayMutationInteropCall) {
    return arrayMutationInteropCall;
  }
  if (arrayWrapperInteropCall) {
    return arrayWrapperInteropCall;
  }

  // Regular function call
  const calleeExprForEmission =
    expr.callee.kind === "memberAccess" && recoveredReceiverBinding
      ? {
          ...expr.callee,
          memberBinding: recoveredReceiverBinding,
        }
      : expr.callee;
  const calleeExpectedType =
    calleeExprForEmission.kind === "memberAccess"
      ? undefined
      : buildCallTargetExpectedType(expr);
  const [calleeAst, newContext] =
    calleeExprForEmission.kind === "memberAccess"
      ? emitMemberAccess(calleeExprForEmission, context, "call")
      : emitExpressionAst(calleeExprForEmission, context, calleeExpectedType);
  let currentContext = newContext;

  let calleeExpr: CSharpExpressionAst = calleeAst;
  let typeArgAsts: readonly CSharpTypeAst[] = [];

  if (expr.typeArguments && expr.typeArguments.length > 0) {
    if (expr.requiresSpecialization) {
      const calleeText = extractCalleeNameFromAst(calleeAst);
      const [specializedName, specContext] = generateSpecializedName(
        calleeText,
        expr.typeArguments,
        currentContext
      );
      calleeExpr = {
        kind: "identifierExpression",
        identifier: specializedName,
      };
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

  const parameterTypeOverrides = getRuntimeObjectHelperParameterOverrides(
    expr,
    expr.arguments.length
  );

  const [argAsts, argContext] = emitCallArguments(
    expr.arguments,
    expr,
    currentContext,
    parameterTypeOverrides
  );
  currentContext = argContext;

  // Build the invocation target (may need optional chaining wrapper)
  const invocationTarget: CSharpExpressionAst = expr.isOptional
    ? (() => {
        // Optional call: callee?.(args) — in C# this requires the callee to be
        // a delegate and the call to be ?.Invoke(). For member access callees
        // the optional chaining is already handled by the member access emitter.
        // For identifiers, emit callee?.Invoke(args).
        if (calleeExpr.kind === "identifierExpression") {
          return {
            kind: "conditionalMemberAccessExpression" as const,
            expression: calleeExpr,
            memberName: "Invoke",
          };
        }
        return calleeExpr;
      })()
    : calleeExpr;

  const invocation: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: invocationTarget,
    arguments: argAsts,
    typeArguments: typeArgAsts.length > 0 ? typeArgAsts : undefined,
  };

  const normalizedInvocation: CSharpExpressionAst =
    shouldNormalizeUnboundJsArrayWrapperResult(
      expr,
      invocationTarget,
      expectedType,
      context
    )
      ? {
          kind: "invocationExpression",
          expression: {
            kind: "memberAccessExpression",
            expression: invocation,
            memberName: "toArray",
          },
          arguments: [],
        }
      : invocation;

  const shouldCastSuperCallResult =
    expr.callee.kind === "memberAccess" &&
    expr.callee.object.kind === "identifier" &&
    expr.callee.object.name === "super" &&
    !!expectedType &&
    expectedType.kind !== "voidType" &&
    expectedType.kind !== "anyType" &&
    expectedType.kind !== "unknownType";

  let finalInvocation: CSharpExpressionAst = normalizedInvocation;
  if (shouldCastSuperCallResult && expectedType) {
    const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
      expectedType,
      currentContext
    );
    finalInvocation = {
      kind: "castExpression",
      type: expectedTypeAst,
      expression: normalizedInvocation,
    };
    currentContext = expectedTypeContext;
  }

  const calleeText = extractCalleeNameFromAst(calleeAst);
  return [
    wrapIntCast(needsIntCast(expr, calleeText), finalInvocation),
    currentContext,
  ];
};
