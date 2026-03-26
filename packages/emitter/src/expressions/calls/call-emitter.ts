/**
 * Call expression emitter — main dispatch and orchestration.
 *
 * Routes call expressions to specialized emitters (promise, array interop,
 * dynamic import, JSON, extension methods) and handles the default regular-call path.
 *
 * Extension method lowering lives in:
 *   - call-extension-methods.ts
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
  needsIntCast,
} from "./call-analysis.js";
import { extractCalleeNameFromAst } from "../../core/format/backend-ast/utils.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
// Import from split modules
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
} from "./call-array-interop.js";
import { emitRuntimeUnionArrayIsArrayCall } from "./call-runtime-union-guards.js";
import { emitCallArguments, wrapIntCast } from "./call-arguments.js";
import { tryEmitExtensionMethodCall } from "./call-extension-methods.js";
import { identifierExpression } from "../../core/format/backend-ast/builders.js";

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

const tryEmitArrayStaticBuiltinCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (
    expr.callee.kind !== "memberAccess" ||
    expr.callee.isComputed ||
    expr.callee.object.kind !== "identifier" ||
    expr.callee.object.name !== "Array" ||
    typeof expr.callee.property !== "string"
  ) {
    return undefined;
  }

  switch (expr.callee.property) {
    case "isArray": {
      if (expr.arguments.length !== 1) {
        return undefined;
      }

      const [argument] = expr.arguments;
      if (!argument || argument.kind === "spread") {
        return undefined;
      }

      const [argumentAst, argumentContext] = emitExpressionAst(argument, context);
      return [
        {
          kind: "invocationExpression",
          expression: identifierExpression(
            "global::Tsonic.Runtime.JSArrayStatics.isArray"
          ),
          arguments: [
            {
              kind: "castExpression",
              type: { kind: "predefinedType", keyword: "object" },
              expression: argumentAst,
            },
          ],
        },
        argumentContext,
      ];
    }

    case "from": {
      const [argAsts, argContext] = emitCallArguments(
        expr.arguments,
        expr,
        context
      );
      return [
        {
          kind: "invocationExpression",
          expression: identifierExpression(
            "global::Tsonic.Runtime.JSArrayStatics.from"
          ),
          arguments: argAsts,
        },
        argContext,
      ];
    }

    case "of": {
      if (expr.arguments.length === 0) {
        return [
          {
            kind: "invocationExpression",
            expression: identifierExpression("global::System.Array.Empty"),
            typeArguments: [{ kind: "predefinedType", keyword: "object" }],
            arguments: [],
          },
          context,
        ];
      }

      const [argAsts, argContext] = emitCallArguments(
        expr.arguments,
        expr,
        context
      );
      return [
        {
          kind: "invocationExpression",
          expression: identifierExpression(
            "global::Tsonic.Runtime.JSArrayStatics.of"
          ),
          arguments: argAsts,
        },
        argContext,
      ];
    }

    default:
      return undefined;
  }
};

/**
 * Emit a function call expression as CSharpExpressionAst
 */
export const emitCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const dynamicImport = emitDynamicImportCall(expr, context);
  if (dynamicImport) return dynamicImport;

  const promiseStaticCall = emitPromiseStaticCall(expr, context);
  if (promiseStaticCall) return promiseStaticCall;

  const promiseChain = emitPromiseThenCatchFinally(expr, context);
  if (promiseChain) return promiseChain;

  const runtimeUnionArrayIsArray = emitRuntimeUnionArrayIsArrayCall(
    expr,
    context
  );
  if (runtimeUnionArrayIsArray) {
    return runtimeUnionArrayIsArray;
  }

  const arrayStaticBuiltinCall = tryEmitArrayStaticBuiltinCall(expr, context);
  if (arrayStaticBuiltinCall) {
    return arrayStaticBuiltinCall;
  }

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

  // EF Core query canonicalization: ToList().ToArray() -> ToArray()
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

  // Extension method lowering — delegated to call-extension-methods.ts
  // Keep this after native array interop so lifted/static container array
  // mutation calls cannot fall through to copy-based JSArray extension syntax.
  const extensionResult = tryEmitExtensionMethodCall(
    expr,
    context,
    expectedType
  );
  if (extensionResult) {
    return extensionResult;
  }

  // Regular function call
  const calleeExprForEmission = expr.callee;
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

  const shouldCastSuperCallResult =
    expr.callee.kind === "memberAccess" &&
    expr.callee.object.kind === "identifier" &&
    expr.callee.object.name === "super" &&
    !!expectedType &&
    expectedType.kind !== "voidType" &&
    expectedType.kind !== "anyType" &&
    expectedType.kind !== "unknownType";

  let finalInvocation: CSharpExpressionAst = invocation;
  if (shouldCastSuperCallResult && expectedType) {
    const [expectedTypeAst, expectedTypeContext] = emitTypeAst(
      expectedType,
      currentContext
    );
    finalInvocation = {
      kind: "castExpression",
      type: expectedTypeAst,
      expression: invocation,
    };
    currentContext = expectedTypeContext;
  }

  const calleeText = extractCalleeNameFromAst(calleeAst);
  return [
    wrapIntCast(needsIntCast(expr, calleeText), finalInvocation),
    currentContext,
  ];
};
