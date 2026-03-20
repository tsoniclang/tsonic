import { IrExpression, IrType } from "@tsonic/frontend";

const ASYNC_WRAPPER_NAMES = new Set([
  "Promise",
  "PromiseLike",
  "Task",
  "ValueTask",
]);

export const isAsyncWrapperType = (
  type: IrType | undefined,
  visited: Set<IrType> = new Set()
): boolean => {
  if (!type || visited.has(type)) return false;
  visited.add(type);

  if (type.kind === "referenceType") {
    const simple = type.name.includes(".")
      ? type.name.slice(type.name.lastIndexOf(".") + 1)
      : type.name;
    if (ASYNC_WRAPPER_NAMES.has(simple)) return true;
  }

  if (type.kind === "unionType" || type.kind === "intersectionType") {
    return type.types.some((t) => isAsyncWrapperType(t, visited));
  }

  return false;
};

export const expressionProducesAsyncWrapper = (expr: IrExpression): boolean => {
  if (expr.kind === "identifier" || expr.kind === "memberAccess") {
    return isAsyncWrapperType(expr.inferredType);
  }

  if (expr.kind === "call" || expr.kind === "new") {
    if (isAsyncWrapperType(expr.inferredType)) return true;
    const calleeType = expr.callee.inferredType;
    if (calleeType?.kind === "functionType") {
      return isAsyncWrapperType(calleeType.returnType);
    }
  }

  return false;
};
