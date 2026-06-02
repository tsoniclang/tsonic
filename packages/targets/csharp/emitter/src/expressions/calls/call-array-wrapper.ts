/**
 * Native array wrapper interop for non-mutation call expressions.
 *
 * Handles source-owned array wrapping for non-mutating calls and result normalization
 * (toArray) when the caller expects a native array type.
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { contextSurfaceIncludesJs, EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import {
  resolveArrayLikeReceiverType,
  resolveTypeAlias,
  substituteTypeArgs,
} from "../../core/semantic/type-resolution.js";
import { needsIntCast } from "./call-analysis.js";
import { emitCallArguments, wrapIntCast } from "./call-arguments.js";
import { buildNativeArrayInteropWrapAst } from "../array-interop.js";
import { emitTypeArgumentsAst } from "../identifiers.js";
import {
  isArrayWrapperBindingType,
  hasDirectNativeArrayLikeInteropShape,
} from "./call-array-mutation.js";
import { getClrIdentityKey } from "../../core/semantic/clr-type-identity.js";
import { surfaceMemberReturnsArray } from "../../core/semantic/surface-member-semantics.js";
import { typeArgumentsAreInScope } from "./call-type-argument-safety.js";
import { areIrTypesEquivalent } from "../../core/semantic/type-equivalence.js";

const isSystemArrayBindingType = (bindingTypeName: string): boolean =>
  getClrIdentityKey(bindingTypeName) === getClrIdentityKey("System.Array");

const isArrayLikeIrType = (type: IrType | undefined): boolean => {
  if (!type) return false;

  if (type.kind === "arrayType" || type.kind === "tupleType") {
    return true;
  }

  if (type.kind === "unionType") {
    return type.types.every((member) => isArrayLikeIrType(member));
  }

  if (type.kind !== "referenceType") {
    return false;
  }

  const simpleName = type.name.split(".").pop() ?? type.name;
  return (
    simpleName === "Array" ||
    simpleName === "ReadonlyArray" ||
    simpleName === "ArrayLike" ||
    simpleName === "Iterable" ||
    simpleName === "IterableIterator" ||
    simpleName === "IEnumerable" ||
    simpleName === "IReadOnlyList" ||
    simpleName === "List"
  );
};

const resolveArrayWrapperGenericTypeArguments = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): readonly IrType[] | undefined => {
  const explicitOrFrontendTypeArguments =
    expr.typeArguments && expr.typeArguments.length > 0
      ? expr.typeArguments
      : undefined;

  const calleeType = expr.callee.inferredType;
  if (
    calleeType?.kind !== "functionType" ||
    !calleeType.typeParameters
  ) {
    return undefined;
  }

  const typeArguments =
    explicitOrFrontendTypeArguments ??
    inferTypeArgumentsFromCallReturn(expr, calleeType, context);
  if (
    !typeArguments ||
    calleeType.typeParameters.length !== typeArguments.length ||
    !typeArgumentsAreInScope(typeArguments, context)
  ) {
    return undefined;
  }

  return typeArguments;
};

const inferTypeArgumentsFromCallReturn = (
  expr: Extract<IrExpression, { kind: "call" }>,
  calleeType: Extract<IrType, { kind: "functionType" }>,
  context: EmitterContext
): readonly IrType[] | undefined => {
  if (!expr.inferredType || !calleeType.returnType) {
    return undefined;
  }

  const typeParameters = calleeType.typeParameters;
  if (!typeParameters || typeParameters.length === 0) {
    return undefined;
  }

  const typeParameterNames = new Set(
    typeParameters.map((parameter) => parameter.name)
  );
  const mapped = new Map<string, IrType>();

  const bind = (pattern: IrType, actual: IrType): boolean => {
    const resolvedPattern = resolveTypeAlias(pattern, context);
    const resolvedActual = resolveTypeAlias(actual, context);

    if (
      resolvedPattern.kind === "typeParameterType" &&
      typeParameterNames.has(resolvedPattern.name)
    ) {
      const existing = mapped.get(resolvedPattern.name);
      if (!existing) {
        mapped.set(resolvedPattern.name, actual);
        return true;
      }
      return areIrTypesEquivalent(existing, actual, context);
    }

    if (
      resolvedPattern.kind === "arrayType" &&
      resolvedActual.kind === "arrayType"
    ) {
      return bind(resolvedPattern.elementType, resolvedActual.elementType);
    }

    if (
      resolvedPattern.kind === "referenceType" &&
      resolvedActual.kind === "referenceType" &&
      resolvedPattern.name === resolvedActual.name
    ) {
      const patternArgs = resolvedPattern.typeArguments ?? [];
      const actualArgs = resolvedActual.typeArguments ?? [];
      return (
        patternArgs.length === actualArgs.length &&
        patternArgs.every((patternArg, index) => {
          const actualArg = actualArgs[index];
          return actualArg ? bind(patternArg, actualArg) : false;
        })
      );
    }

    if (
      resolvedPattern.kind === "unionType" &&
      resolvedActual.kind === "unionType" &&
      resolvedPattern.types.length === resolvedActual.types.length
    ) {
      return resolvedPattern.types.every((patternMember, index) => {
        const actualMember = resolvedActual.types[index];
        return actualMember ? bind(patternMember, actualMember) : false;
      });
    }

    return areIrTypesEquivalent(resolvedPattern, resolvedActual, context);
  };

  if (!bind(calleeType.returnType, expr.inferredType)) {
    return undefined;
  }

  const inferred = typeParameters.map((parameter) =>
    mapped.get(parameter.name)
  );
  return inferred.every((type): type is IrType => type !== undefined)
    ? inferred
    : undefined;
};

const buildArrayWrapperParameterTypeOverrides = (
  expr: Extract<IrExpression, { kind: "call" }>,
  typeArguments: readonly IrType[] | undefined
): readonly (IrType | undefined)[] | undefined => {
  if (!typeArguments || typeArguments.length === 0) {
    return undefined;
  }

  const calleeType = expr.callee.inferredType;
  if (
    calleeType?.kind !== "functionType" ||
    !calleeType.typeParameters ||
    calleeType.typeParameters.length !== typeArguments.length
  ) {
    return undefined;
  }

  const typeParameterNames = calleeType.typeParameters.map(
    (parameter) => parameter.name
  );
  return calleeType.parameters.map((parameter) =>
    parameter.type
      ? substituteTypeArgs(parameter.type, typeParameterNames, typeArguments)
      : undefined
  );
};

export const shouldNormalizeArrayLikeInteropResult = (
  actualType: IrType | undefined,
  expectedType: IrType | undefined
): boolean => isArrayLikeIrType(expectedType) || isArrayLikeIrType(actualType);

const shouldNormalizeNativeArrayWrapperResult = (
  expr: Extract<IrExpression, { kind: "call" }>,
  expectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (shouldNormalizeArrayLikeInteropResult(expr.inferredType, expectedType)) {
    return true;
  }

  if (expr.callee.kind !== "memberAccess") {
    return false;
  }
  const receiverType =
    resolveEffectiveExpressionType(expr.callee.object, context) ??
    expr.callee.object.inferredType;
  if (!hasDirectNativeArrayLikeInteropShape(receiverType)) {
    return false;
  }

  const binding = expr.callee.memberBinding;
  if (!binding || binding.isExtensionMethod) {
    return false;
  }

  return (
    binding.kind === "method" && surfaceMemberReturnsArray(binding, context)
  );
};

export const emitArrayWrapperInteropCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!contextSurfaceIncludesJs(context)) return undefined;
  if (expr.isOptional) return undefined;
  if (expr.callee.kind !== "memberAccess") return undefined;
  if (expr.callee.isComputed) return undefined;
  if (typeof expr.callee.property !== "string") return undefined;

  const binding = expr.callee.memberBinding;
  const receiverType =
    resolveEffectiveExpressionType(expr.callee.object, context) ??
    expr.callee.object.inferredType;
  const receiverElementType = resolveArrayLikeReceiverType(
    receiverType,
    context
  )?.elementType;
  if (!receiverElementType) {
    return undefined;
  }

  let currentContext = context;
  const [receiverAst, receiverContext] = emitExpressionAst(
    expr.callee.object,
    currentContext
  );
  currentContext = receiverContext;

  const wrapperAst = buildNativeArrayInteropWrapAst(receiverAst);

  const wrapperTypeArguments = resolveArrayWrapperGenericTypeArguments(
    expr,
    currentContext
  );
  const parameterTypeOverrides = buildArrayWrapperParameterTypeOverrides(
    expr,
    wrapperTypeArguments
  );
  const [argAsts, argContext] = emitCallArguments(
    expr.arguments,
    expr,
    currentContext,
    parameterTypeOverrides
  );
  currentContext = argContext;
  const [typeArgAsts, typeArgContext] =
    wrapperTypeArguments && wrapperTypeArguments.length > 0
      ? emitTypeArgumentsAst(wrapperTypeArguments, currentContext)
      : [[], currentContext];
  currentContext = typeArgContext;

  if (
    expr.callee.property === "at" &&
    (!binding ||
      isSystemArrayBindingType(binding.type) ||
      isArrayWrapperBindingType(binding.type))
  ) {
    return [
      {
        kind: "invocationExpression",
        expression: {
          kind: "memberAccessExpression",
          expression: wrapperAst,
          memberName: binding?.member ?? "at",
        },
        typeArguments: typeArgAsts.length > 0 ? typeArgAsts : undefined,
        arguments: argAsts,
      },
      currentContext,
    ];
  }

  if (
    !binding ||
    (binding.isExtensionMethod && !isArrayWrapperBindingType(binding.type))
  ) {
    return undefined;
  }

  if (isSystemArrayBindingType(binding.type)) {
    return undefined;
  }

  const invocation: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: wrapperAst,
      memberName: binding.member,
    },
    typeArguments: typeArgAsts.length > 0 ? typeArgAsts : undefined,
    arguments: argAsts,
  };

  const resultAst: CSharpExpressionAst =
    shouldNormalizeNativeArrayWrapperResult(expr, expectedType, currentContext)
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

  return [
    wrapIntCast(needsIntCast(expr, expr.callee.property), resultAst),
    currentContext,
  ];
};
