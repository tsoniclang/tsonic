/**
 * New expression emitter
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitTypeArguments, generateSpecializedName } from "../identifiers.js";
import { emitType } from "../../type-emitter.js";
import { isLValue, getPassingModifierFromCast } from "./call-analysis.js";
import { printExpression } from "../../core/format/backend-ast/printer.js";
import type { CSharpExpressionAst } from "../../core/format/backend-ast/types.js";

/**
 * Check if a new expression is new List<T>([...]) with an array literal argument
 */
const isListConstructorWithArrayLiteral = (
  expr: Extract<IrExpression, { kind: "new" }>
): boolean => {
  const inferredType = expr.inferredType;
  if (inferredType?.kind !== "referenceType") {
    return false;
  }
  const typeId = inferredType.typeId;
  if (
    !typeId ||
    !typeId.clrName.startsWith("System.Collections.Generic.List")
  ) {
    return false;
  }

  if (!expr.typeArguments || expr.typeArguments.length !== 1) {
    return false;
  }

  if (expr.callee.kind !== "identifier" || expr.callee.name !== "List") {
    return false;
  }

  if (expr.arguments.length !== 1) {
    return false;
  }

  const arg = expr.arguments[0];
  if (!arg || arg.kind === "spread" || arg.kind !== "array") {
    return false;
  }

  for (const element of arg.elements) {
    if (!element || element.kind === "spread") {
      return false;
    }
  }

  return true;
};

/**
 * Emit new List<T>([...]) as collection initializer: new List<T> { ... }
 */
const emitListCollectionInitializer = (
  expr: Extract<IrExpression, { kind: "new" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;

  const [calleeAst, calleeContext] = emitExpressionAst(
    expr.callee,
    currentContext
  );
  currentContext = calleeContext;
  let calleeText = printExpression(calleeAst);

  let typeArgsStr = "";
  if (expr.typeArguments && expr.typeArguments.length > 0) {
    if (expr.requiresSpecialization) {
      const [specializedName, specContext] = generateSpecializedName(
        calleeText,
        expr.typeArguments,
        currentContext
      );
      calleeText = specializedName;
      currentContext = specContext;
    } else {
      const [typeArgs, typeContext] = emitTypeArguments(
        expr.typeArguments,
        currentContext
      );
      typeArgsStr = typeArgs;
      currentContext = typeContext;
    }
  }

  const arrayLiteral = expr.arguments[0] as Extract<
    IrExpression,
    { kind: "array" }
  >;

  const elemTexts: string[] = [];
  for (const element of arrayLiteral.elements) {
    if (element === undefined) {
      continue;
    }
    if (element.kind === "spread") {
      const [fallbackAst, fallbackContext] = emitNew(expr, currentContext);
      return [fallbackAst, fallbackContext];
    } else {
      const [elemAst, ctx] = emitExpressionAst(element, currentContext);
      elemTexts.push(printExpression(elemAst));
      currentContext = ctx;
    }
  }

  const text =
    elemTexts.length === 0
      ? `new ${calleeText}${typeArgsStr}()`
      : `new ${calleeText}${typeArgsStr} { ${elemTexts.join(", ")} }`;

  return [{ kind: "identifierExpression", identifier: text }, currentContext];
};

/**
 * Check if a new expression is new Array<T>(size)
 */
const isArrayConstructorCall = (
  expr: Extract<IrExpression, { kind: "new" }>
): boolean => {
  if (expr.callee.kind !== "identifier" || expr.callee.name !== "Array") {
    return false;
  }

  if (!expr.typeArguments || expr.typeArguments.length !== 1) {
    return false;
  }

  return true;
};

/**
 * Emit new Array<T>(size) as new T[size]
 */
const emitArrayConstructor = (
  expr: Extract<IrExpression, { kind: "new" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  let currentContext = context;

  const typeArgs = expr.typeArguments;
  const elementType = typeArgs?.[0];
  if (!elementType) {
    return [
      { kind: "identifierExpression", identifier: "new object[0]" },
      currentContext,
    ];
  }
  const [elementTypeStr, typeContext] = emitType(elementType, currentContext);
  currentContext = typeContext;

  let sizeStr = "0";
  if (expr.arguments.length > 0) {
    const sizeArg = expr.arguments[0];
    if (sizeArg && sizeArg.kind !== "spread") {
      const [sizeAst, sizeContext] = emitExpressionAst(sizeArg, currentContext);
      sizeStr = printExpression(sizeAst);
      currentContext = sizeContext;
    }
  }

  const text = `new ${elementTypeStr}[${sizeStr}]`;
  return [{ kind: "identifierExpression", identifier: text }, currentContext];
};

const isPromiseConstructorCall = (
  expr: Extract<IrExpression, { kind: "new" }>
): boolean => {
  return expr.callee.kind === "identifier" && expr.callee.name === "Promise";
};

const isVoidLikeType = (type: IrType | undefined): boolean => {
  if (!type) return false;
  return (
    type.kind === "voidType" ||
    (type.kind === "primitiveType" && type.name === "undefined")
  );
};

/**
 * Check if a type contains `void` in a position where it would be emitted
 * as a C# generic type argument.
 */
const containsVoidInGenericPosition = (type: IrType | undefined): boolean => {
  if (!type) return false;
  if (type.kind === "unionType") {
    return type.types.some(
      (t) => isVoidLikeType(t) || containsVoidInGenericPosition(t)
    );
  }
  if (type.kind === "referenceType" && type.typeArguments) {
    return type.typeArguments.some(
      (t) => isVoidLikeType(t) || containsVoidInGenericPosition(t)
    );
  }
  if (type.kind === "functionType") {
    return (
      type.parameters.some((p) => containsVoidInGenericPosition(p.type)) ||
      containsVoidInGenericPosition(type.returnType)
    );
  }
  return false;
};

const getPromiseValueType = (
  expr: Extract<IrExpression, { kind: "new" }>
): IrType | undefined => {
  const inferred = expr.inferredType;
  if (inferred?.kind === "referenceType") {
    const candidate = inferred.typeArguments?.[0];
    if (candidate && !isVoidLikeType(candidate)) {
      return candidate;
    }
    if (candidate && isVoidLikeType(candidate)) {
      return undefined;
    }
  }

  const explicit = expr.typeArguments?.[0];
  if (explicit && !isVoidLikeType(explicit)) {
    return explicit;
  }

  return undefined;
};

const getExecutorArity = (
  expr: Extract<IrExpression, { kind: "new" }>
): number => {
  const executor = expr.arguments[0];
  if (
    executor &&
    executor.kind !== "spread" &&
    (executor.kind === "arrowFunction" ||
      executor.kind === "functionExpression")
  ) {
    return executor.parameters.length;
  }

  const executorType = expr.parameterTypes?.[0];
  if (executorType?.kind === "functionType") {
    return executorType.parameters.length;
  }

  return 1;
};

const emitPromiseConstructor = (
  expr: Extract<IrExpression, { kind: "new" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const executor = expr.arguments[0];
  if (!executor || executor.kind === "spread") {
    throw new Error(
      "Unsupported Promise constructor form: expected an executor function argument."
    );
  }

  let currentContext = context;
  const [taskTypeTextRaw, taskTypeContext] = expr.inferredType
    ? emitType(expr.inferredType, currentContext)
    : ["global::System.Threading.Tasks.Task", currentContext];
  currentContext = taskTypeContext;
  const taskTypeText =
    taskTypeTextRaw.length > 0
      ? taskTypeTextRaw
      : "global::System.Threading.Tasks.Task";

  const promiseValueType = getPromiseValueType(expr);
  let valueTypeText = "bool";
  if (promiseValueType) {
    const [valueType, valueTypeContext] = emitType(
      promiseValueType,
      currentContext
    );
    valueTypeText = valueType;
    currentContext = valueTypeContext;
  }

  // Track resolve parameter name for void promise
  const resolveParam =
    !promiseValueType &&
    (executor.kind === "arrowFunction" ||
      executor.kind === "functionExpression")
      ? executor.parameters[0]
      : undefined;
  const resolveParamName =
    resolveParam?.pattern.kind === "identifierPattern"
      ? resolveParam.pattern.name
      : undefined;

  const executorEmitContext = resolveParamName
    ? { ...currentContext, voidResolveNames: new Set([resolveParamName]) }
    : currentContext;

  const resolveParamHasVoidGeneric =
    resolveParam?.type?.kind === "functionType" &&
    resolveParam.type.parameters.some((p) =>
      containsVoidInGenericPosition(p.type)
    );
  const emittedExecutor =
    resolveParamHasVoidGeneric &&
    (executor.kind === "arrowFunction" ||
      executor.kind === "functionExpression")
      ? {
          ...executor,
          parameters: executor.parameters.map((p, i) =>
            i === 0 ? { ...p, type: undefined } : p
          ),
        }
      : executor;

  const [executorAst, executorContext] = emitExpressionAst(
    emittedExecutor,
    executorEmitContext,
    expr.parameterTypes?.[0]
  );
  currentContext = resolveParamName
    ? { ...executorContext, voidResolveNames: undefined }
    : executorContext;

  const executorText = printExpression(executorAst);
  const executorArity = getExecutorArity(expr);
  const resolveCallbackType = promiseValueType
    ? `global::System.Action<${valueTypeText}>`
    : "global::System.Action";
  const executorDelegateType =
    executorArity >= 2
      ? `global::System.Action<${resolveCallbackType}, global::System.Action<object?>>`
      : `global::System.Action<${resolveCallbackType}>`;
  const executorInvokeTarget = `((${executorDelegateType})${executorText})`;
  const invokeArgs =
    executorArity >= 2
      ? "__tsonic_resolve, __tsonic_reject"
      : "__tsonic_resolve";

  const resolveDecl = promiseValueType
    ? `global::System.Action<${valueTypeText}> __tsonic_resolve = (value) => __tsonic_tcs.TrySetResult(value);`
    : "global::System.Action __tsonic_resolve = () => __tsonic_tcs.TrySetResult(true);";

  const text =
    `((global::System.Func<${taskTypeText}>)(() => { ` +
    `var __tsonic_tcs = new global::System.Threading.Tasks.TaskCompletionSource<${valueTypeText}>(); ` +
    `${resolveDecl} ` +
    `global::System.Action<object?> __tsonic_reject = (error) => __tsonic_tcs.TrySetException((error as global::System.Exception) ?? new global::System.Exception(error?.ToString() ?? "Promise rejected")); ` +
    `try { ${executorInvokeTarget}(${invokeArgs}); } catch (global::System.Exception ex) { __tsonic_tcs.TrySetException(ex); } ` +
    `return __tsonic_tcs.Task; }))()`;

  return [{ kind: "identifierExpression", identifier: text }, currentContext];
};

/**
 * Emit a new expression as CSharpExpressionAst
 */
export const emitNew = (
  expr: Extract<IrExpression, { kind: "new" }>,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  // Special case: new Array<T>(size) → new T[size]
  if (isArrayConstructorCall(expr)) {
    return emitArrayConstructor(expr, context);
  }

  // Special case: new List<T>([...]) → new List<T> { ... }
  if (isListConstructorWithArrayLiteral(expr)) {
    return emitListCollectionInitializer(expr, context);
  }

  // Promise constructor lowering
  if (isPromiseConstructorCall(expr)) {
    return emitPromiseConstructor(expr, context);
  }

  const [calleeAst, newContext] = emitExpressionAst(expr.callee, context);
  let currentContext = newContext;
  let calleeText = printExpression(calleeAst);

  let typeArgsStr = "";

  if (expr.typeArguments && expr.typeArguments.length > 0) {
    if (expr.requiresSpecialization) {
      const [specializedName, specContext] = generateSpecializedName(
        calleeText,
        expr.typeArguments,
        currentContext
      );
      calleeText = specializedName;
      currentContext = specContext;
    } else {
      const [typeArgs, typeContext] = emitTypeArguments(
        expr.typeArguments,
        currentContext
      );
      typeArgsStr = typeArgs;
      currentContext = typeContext;
    }
  }

  const argTexts: string[] = [];
  const parameterTypes = expr.parameterTypes ?? [];
  for (let i = 0; i < expr.arguments.length; i++) {
    const arg = expr.arguments[i];
    if (!arg) continue;
    if (arg.kind === "spread") {
      const [spreadAst, ctx] = emitExpressionAst(
        arg.expression,
        currentContext
      );
      argTexts.push(`params ${printExpression(spreadAst)}`);
      currentContext = ctx;
    } else {
      const expectedType = parameterTypes[i];
      const castModifier = getPassingModifierFromCast(arg);
      if (castModifier && isLValue(arg)) {
        const [argAst, ctx] = emitExpressionAst(arg, currentContext);
        argTexts.push(`${castModifier} ${printExpression(argAst)}`);
        currentContext = ctx;
      } else {
        const [argAst, ctx] = emitExpressionAst(
          arg,
          currentContext,
          expectedType
        );
        const passingMode = expr.argumentPassing?.[i];
        const prefix =
          passingMode && passingMode !== "value" && isLValue(arg)
            ? `${passingMode} `
            : "";
        argTexts.push(`${prefix}${printExpression(argAst)}`);
        currentContext = ctx;
      }
    }
  }

  const text = `new ${calleeText}${typeArgsStr}(${argTexts.join(", ")})`;
  return [{ kind: "identifierExpression", identifier: text }, currentContext];
};
