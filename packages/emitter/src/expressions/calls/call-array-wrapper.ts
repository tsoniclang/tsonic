/**
 * Native array wrapper interop for non-mutation call expressions.
 *
 * Handles JSArray wrapping for non-mutating calls and result normalization
 * (toArray) when the caller expects a native array type.
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import type {
  CSharpExpressionAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";
import { identifierType } from "../../core/format/backend-ast/builders.js";
import { getIdentifierTypeLeafName } from "../../core/format/backend-ast/utils.js";
import { resolveEffectiveExpressionType } from "../../core/semantic/narrowed-expression-types.js";
import { resolveArrayLikeReceiverType } from "../../core/semantic/type-resolution.js";
import { needsIntCast } from "./call-analysis.js";
import {
  emitCallArguments,
  wrapIntCast,
  emitArrayWrapperElementTypeAst,
} from "./call-arguments.js";
import {
  isJsArrayWrapperBindingType,
  hasDirectNativeArrayLikeInteropShape,
  nativeArrayReturningInteropMembers,
} from "./call-array-mutation.js";

const stripClrGenericArity = (typeName: string): string =>
  typeName.replace(/`\d+$/, "");

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
    simpleName === "JSArray" ||
    simpleName === "Iterable" ||
    simpleName === "IterableIterator" ||
    simpleName === "IEnumerable" ||
    simpleName === "IReadOnlyList" ||
    simpleName === "List"
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
  if (typeof expr.callee.property !== "string") {
    return false;
  }
  if (!nativeArrayReturningInteropMembers.has(expr.callee.property)) {
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

  return binding.kind === "method";
};

const isJsArrayObjectCreationAst = (
  expr: CSharpExpressionAst
): expr is Extract<CSharpExpressionAst, { kind: "objectCreationExpression" }> =>
  expr.kind === "objectCreationExpression" &&
  getIdentifierTypeLeafName(expr.type) === "JSArray";

export const shouldNormalizeUnboundJsArrayWrapperResult = (
  expr: Extract<IrExpression, { kind: "call" }>,
  calleeAst: CSharpExpressionAst,
  expectedType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!shouldNormalizeArrayLikeInteropResult(expr.inferredType, expectedType)) {
    return false;
  }
  if (expr.callee.kind !== "memberAccess") {
    return false;
  }
  if (typeof expr.callee.property !== "string") {
    return false;
  }
  if (!nativeArrayReturningInteropMembers.has(expr.callee.property)) {
    return false;
  }
  if (expr.callee.memberBinding) {
    return false;
  }

  const receiverType =
    resolveEffectiveExpressionType(expr.callee.object, context) ??
    expr.callee.object.inferredType;
  if (!hasDirectNativeArrayLikeInteropShape(receiverType)) {
    return false;
  }

  return (
    (calleeAst.kind === "memberAccessExpression" &&
      isJsArrayObjectCreationAst(calleeAst.expression)) ||
    (calleeAst.kind === "conditionalMemberAccessExpression" &&
      isJsArrayObjectCreationAst(calleeAst.expression))
  );
};

export const emitArrayWrapperInteropCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (expr.isOptional) return undefined;
  if (expr.callee.kind !== "memberAccess") return undefined;
  if (expr.callee.isComputed) return undefined;
  if (typeof expr.callee.property !== "string") return undefined;

  const binding = expr.callee.memberBinding;
  if (
    !binding ||
    (binding.isExtensionMethod && !isJsArrayWrapperBindingType(binding.type))
  ) {
    return undefined;
  }

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

  const bindingType = binding.type;
  if (
    bindingType === "System.Array" ||
    bindingType === "global::System.Array" ||
    bindingType.startsWith("System.Array`") ||
    bindingType.startsWith("global::System.Array`")
  ) {
    return undefined;
  }

  const arityText = bindingType.match(/`(\d+)$/)?.[1];
  const genericArity = arityText ? Number.parseInt(arityText, 10) : 0;
  if (genericArity > 1) return undefined;

  let currentContext = context;
  const [receiverAst, receiverContext] = emitExpressionAst(
    expr.callee.object,
    currentContext
  );
  currentContext = receiverContext;

  let typeArguments: readonly CSharpTypeAst[] | undefined;
  if (genericArity === 1) {
    const [elementTypeAst, elementTypeContext] = emitArrayWrapperElementTypeAst(
      receiverType ?? {
        kind: "arrayType",
        elementType: receiverElementType,
        origin: "explicit",
      },
      currentContext
    );
    currentContext = elementTypeContext;
    typeArguments = [elementTypeAst];
  }

  const wrapperAst: CSharpExpressionAst = {
    kind: "objectCreationExpression",
    type: identifierType(
      `global::${stripClrGenericArity(bindingType)}`,
      typeArguments
    ),
    arguments: [receiverAst],
  };

  const [argAsts, argContext] = emitCallArguments(
    expr.arguments,
    expr,
    currentContext
  );
  currentContext = argContext;

  const invocation: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: wrapperAst,
      memberName: binding.member,
    },
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
