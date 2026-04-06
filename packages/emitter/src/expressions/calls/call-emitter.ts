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
import {
  identifierExpression,
  identifierType,
} from "../../core/format/backend-ast/builders.js";
import { normalizeClrQualifiedName } from "../../core/format/backend-ast/utils.js";
// Import from split modules
import { emitDynamicImportCall } from "./call-dynamic-import.js";
import {
  emitJsonSerializerCall,
  emitGlobalJsonCall,
} from "./call-json.js";
import { emitGlobalSymbolCall } from "./call-symbol.js";
import {
  emitPromiseStaticCall,
  emitPromiseThenCatchFinally,
  buildDelegateType,
} from "./call-promise.js";
import {
  emitArrayMutationInteropCall,
  emitArrayWrapperInteropCall,
} from "./call-array-interop.js";
import { emitRuntimeUnionArrayIsArrayCall } from "./call-runtime-union-guards.js";
import { emitCallArguments, wrapIntCast } from "./call-arguments.js";
import { tryEmitExtensionMethodCall } from "./call-extension-methods.js";
import { stripClrGenericArity } from "../access-resolution.js";

const buildCallTargetExpectedType = (
  expr: Extract<IrExpression, { kind: "call" }>
): IrType | undefined => {
  const calleeType = expr.callee.inferredType;
  if (calleeType?.kind === "functionType") {
    return calleeType;
  }

  const parameterTypes = expr.parameterTypes ?? expr.surfaceParameterTypes;
  const restParameter = expr.restParameter ?? expr.surfaceRestParameter;

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

const tryGetCallableStaticAccessorCall = (
  expr: Extract<IrExpression, { kind: "call" }>
):
  | {
      readonly kind: "property" | "field";
      readonly binding: NonNullable<
        Extract<IrExpression, { kind: "call" }>["callee"] extends infer T
          ? T extends { kind: "memberAccess"; memberBinding?: infer B }
            ? B
            : never
          : never
      >;
    }
  | undefined => {
  if (expr.callee.kind !== "memberAccess") {
    return undefined;
  }

  const memberBinding = expr.callee.memberBinding;
  const kind = memberBinding?.emitSemantics?.callableStaticAccessorKind;
  if (!memberBinding || !kind) {
    return undefined;
  }

  return { kind, binding: memberBinding };
};

const getCallableStaticAccessorOwnerTypeArgs = (
  expr: Extract<IrExpression, { kind: "call" }>,
  expectedArity: number
): readonly IrType[] => {
  if (expectedArity === 0) {
    return [];
  }

  if (expr.typeArguments?.length === expectedArity) {
    return expr.typeArguments;
  }

  const inferredResult = expr.inferredType;
  if (
    inferredResult?.kind === "referenceType" &&
    inferredResult.typeArguments?.length === expectedArity
  ) {
    return inferredResult.typeArguments;
  }

  throw new Error(
    `Internal Compiler Error: callable static accessor call '${expectedArity}' generic arity could not be specialized from call-site type arguments.`
  );
};

const emitCallableStaticAccessorCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  binding: NonNullable<
    Extract<IrExpression, { kind: "call" }>["callee"] extends infer T
      ? T extends { kind: "memberAccess"; memberBinding?: infer B }
        ? B
        : never
      : never
  >,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (expr.arguments.length !== 0) {
    throw new Error(
      `Internal Compiler Error: callable static accessor '${binding.type}.${binding.member}' was invoked with arguments.`
    );
  }
  if (expr.isOptional) {
    throw new Error(
      `Internal Compiler Error: callable static accessor '${binding.type}.${binding.member}' cannot be optional.`
    );
  }

  const arityText = binding.type.match(/`(\d+)$/)?.[1];
  const genericArity = arityText ? Number.parseInt(arityText, 10) : 0;
  const ownerTypeArgs = getCallableStaticAccessorOwnerTypeArgs(expr, genericArity);

  let currentContext = context;
  const ownerTypeArgAsts: CSharpTypeAst[] = [];
  for (const typeArgument of ownerTypeArgs) {
    const [typeArgAst, typeArgContext] = emitTypeAst(typeArgument, currentContext);
    ownerTypeArgAsts.push(typeArgAst);
    currentContext = typeArgContext;
  }

  const ownerTypeAst = identifierType(
    normalizeClrQualifiedName(stripClrGenericArity(binding.type), true),
    ownerTypeArgAsts.length > 0 ? ownerTypeArgAsts : undefined
  );

  return [
    {
      kind: "memberAccessExpression",
      expression: {
        kind: "typeReferenceExpression",
        type: ownerTypeAst,
      },
      memberName: binding.member,
    },
    currentContext,
  ];
};

const castInvokedLambdaTarget = (
  calleeExpr: CSharpExpressionAst,
  calleeType: IrType | undefined,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (calleeExpr.kind !== "lambdaExpression") {
    return [calleeExpr, context];
  }
  if (!calleeType || calleeType.kind !== "functionType") {
    throw new Error(
      "Internal Compiler Error: Immediately-invoked function expression reached call emission without a concrete function type."
    );
  }

  let currentContext = context;
  const parameterTypeAsts: CSharpTypeAst[] = [];
  for (const parameter of calleeType.parameters) {
    if (!parameter?.type) {
      throw new Error(
        "Internal Compiler Error: Function-expression invocation parameter is missing a concrete type."
      );
    }
    const [parameterTypeAst, parameterTypeContext] = emitTypeAst(
      parameter.type,
      currentContext
    );
    parameterTypeAsts.push(parameterTypeAst);
    currentContext = parameterTypeContext;
  }

  const [returnTypeAst, returnTypeContext] = emitTypeAst(
    calleeType.returnType,
    currentContext
  );

  return [
    {
      kind: "parenthesizedExpression",
      expression: {
        kind: "castExpression",
        type: buildDelegateType(parameterTypeAsts, returnTypeAst),
        expression: {
          kind: "parenthesizedExpression",
          expression: calleeExpr,
        },
      },
    },
    returnTypeContext,
  ];
};

const emitSyntheticArraySliceCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (expr.callee.kind !== "memberAccess") {
    return undefined;
  }

  const binding = expr.callee.memberBinding;
  if (
    binding?.assembly !== "__synthetic" ||
    binding.type !== "Array" ||
    binding.member !== "slice" ||
    expr.arguments.length !== 1
  ) {
    return undefined;
  }

  const startIndex = expr.arguments[0];
  if (!startIndex || startIndex.kind === "spread") {
    return undefined;
  }

  const [receiverAst, receiverContext] = emitExpressionAst(
    expr.callee.object,
    context
  );
  const [startAst, startContext] = emitExpressionAst(
    startIndex,
    receiverContext,
    { kind: "primitiveType", name: "int" }
  );

  return [
    {
      kind: "invocationExpression",
      expression: identifierExpression("global::System.Linq.Enumerable.ToArray"),
      arguments: [
        {
          kind: "invocationExpression",
          expression: identifierExpression("global::System.Linq.Enumerable.Skip"),
          arguments: [receiverAst, startAst],
        },
      ],
    },
    startContext,
  ];
};

/**
 * Emit a function call expression as CSharpExpressionAst
 */
export const emitCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const syntheticArraySlice = emitSyntheticArraySliceCall(expr, context);
  if (syntheticArraySlice) {
    return syntheticArraySlice;
  }

  const dynamicImport = emitDynamicImportCall(expr, context);
  if (dynamicImport) return dynamicImport;

  const promiseStaticCall = emitPromiseStaticCall(expr, context, expectedType);
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

  if (expr.intrinsicKind === "globalSymbol") {
    return emitGlobalSymbolCall(expr, context);
  }

  // Check for global JSON.stringify/parse calls
  const globalJsonCall = isGlobalJsonCall(expr.callee, context);
  if (globalJsonCall) {
    return emitGlobalJsonCall(expr, context, globalJsonCall.method, expectedType);
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
  // mutation calls cannot fall through to copy-based source-owned array syntax.
  const extensionResult = tryEmitExtensionMethodCall(
    expr,
    context,
    expectedType
  );
  if (extensionResult) {
    return extensionResult;
  }

  const callableStaticAccessor = tryGetCallableStaticAccessorCall(expr);
  if (callableStaticAccessor) {
    return emitCallableStaticAccessorCall(
      expr,
      callableStaticAccessor.binding,
      context
    );
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
  if (calleeExpr.kind === "lambdaExpression") {
    const castedLambdaTarget = castInvokedLambdaTarget(
      calleeExpr,
      calleeExpectedType,
      currentContext
    );
    calleeExpr = castedLambdaTarget[0];
    currentContext = castedLambdaTarget[1];
  }

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

  const [argAsts, argContext] = emitCallArguments(
    expr.arguments,
    expr,
    currentContext
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
