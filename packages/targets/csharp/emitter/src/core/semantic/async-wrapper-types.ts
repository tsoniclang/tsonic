import {
  getAwaitedIrType,
  isAwaitableIrType,
  type IrExpression,
  type IrType,
} from "@tsonic/frontend";

const typeContainsAsyncWrapper = (
  type: IrType | undefined,
  visited: Set<IrType> = new Set()
): boolean => {
  if (!type || visited.has(type)) {
    return false;
  }
  visited.add(type);

  if (type.kind === "referenceType") {
    return isAwaitableIrType(type);
  }

  if (type.kind === "unionType" || type.kind === "intersectionType") {
    return type.types.some((member) =>
      typeContainsAsyncWrapper(member, visited)
    );
  }

  return false;
};

const getCallReturnType = (expr: IrExpression): IrType | undefined => {
  if (expr.kind !== "call" && expr.kind !== "new") {
    return undefined;
  }

  const calleeType = expr.callee.inferredType;
  return calleeType?.kind === "functionType"
    ? calleeType.returnType
    : undefined;
};

export const isAsyncWrapperType = (type: IrType | undefined): boolean =>
  typeContainsAsyncWrapper(type);

export const getExpressionAsyncWrapperType = (
  expr: IrExpression
): IrType | undefined => {
  if (typeContainsAsyncWrapper(expr.inferredType)) {
    return expr.inferredType;
  }

  if (expr.kind === "call" || expr.kind === "new") {
    if (typeContainsAsyncWrapper(expr.sourceBackedReturnType)) {
      return expr.sourceBackedReturnType;
    }

    const calleeReturnType = getCallReturnType(expr);
    if (typeContainsAsyncWrapper(calleeReturnType)) {
      return calleeReturnType;
    }
  }

  return undefined;
};

export const expressionProducesAsyncWrapper = (expr: IrExpression): boolean =>
  getExpressionAsyncWrapperType(expr) !== undefined;

export const getAsyncWrapperResultType = (
  expr: IrExpression
): IrType | undefined => {
  const wrapperType = getExpressionAsyncWrapperType(expr);
  if (wrapperType?.kind === "referenceType") {
    const awaitedType = getAwaitedIrType(wrapperType);
    if (awaitedType) {
      return awaitedType;
    }
  }

  const sourceBackedAwaited =
    (expr.kind === "call" || expr.kind === "new") && expr.sourceBackedReturnType
      ? getAwaitedIrType(expr.sourceBackedReturnType)
      : undefined;
  if (sourceBackedAwaited) {
    return sourceBackedAwaited;
  }

  const calleeReturnType = getCallReturnType(expr);
  const calleeAwaited =
    calleeReturnType?.kind === "referenceType"
      ? getAwaitedIrType(calleeReturnType)
      : undefined;
  if (calleeAwaited) {
    return calleeAwaited;
  }

  const inferredAwaited =
    expr.inferredType?.kind === "referenceType"
      ? getAwaitedIrType(expr.inferredType)
      : undefined;
  return inferredAwaited ?? expr.inferredType;
};

export const getAsyncWrapperSourceResultType = (
  expr: IrExpression
): IrType | undefined => {
  const sourceBackedAwaited =
    (expr.kind === "call" || expr.kind === "new") && expr.sourceBackedReturnType
      ? getAwaitedIrType(expr.sourceBackedReturnType)
      : undefined;
  if (sourceBackedAwaited) {
    return sourceBackedAwaited;
  }

  const calleeReturnType = getCallReturnType(expr);
  const calleeAwaited =
    calleeReturnType?.kind === "referenceType"
      ? getAwaitedIrType(calleeReturnType)
      : undefined;
  if (calleeAwaited) {
    return calleeAwaited;
  }

  return getAsyncWrapperResultType(expr);
};
