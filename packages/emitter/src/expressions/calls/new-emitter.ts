/**
 * New expression emitter
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";
import { emitTypeArguments, generateSpecializedName } from "../identifiers.js";
import { emitType } from "../../type-emitter.js";
import { formatPostfixExpressionText } from "../parentheses.js";
import { isLValue, getPassingModifierFromCast } from "./call-analysis.js";

/**
 * Check if a new expression is new List<T>([...]) with an array literal argument
 * This pattern should be emitted as collection initializer: new List<T> { ... }
 */
const isListConstructorWithArrayLiteral = (
  expr: Extract<IrExpression, { kind: "new" }>
): boolean => {
  // Only apply to BCL List<T> so the rewrite is semantics-safe.
  // (We rely on List<T> having a parameterless ctor + Add for collection initializer.)
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

  // Must have exactly one type argument
  if (!expr.typeArguments || expr.typeArguments.length !== 1) {
    return false;
  }

  // Check if callee is identifier "List"
  if (expr.callee.kind !== "identifier" || expr.callee.name !== "List") {
    return false;
  }

  // Must have exactly one argument that is an array literal
  if (expr.arguments.length !== 1) {
    return false;
  }

  const arg = expr.arguments[0];
  if (!arg || arg.kind === "spread" || arg.kind !== "array") {
    return false;
  }

  // Collection initializers don't support spreads/holes, so reject them here.
  for (const element of arg.elements) {
    if (!element || element.kind === "spread") {
      return false;
    }
  }

  return true;
};

/**
 * Emit new List<T>([...]) as collection initializer: new List<T> { ... }
 *
 * Examples:
 *   new List<int>([1, 2, 3])      → new List<int> { 1, 2, 3 }
 *   new List<string>(["a", "b"]) → new List<string> { "a", "b" }
 *   new List<User>([u1, u2])     → new List<User> { u1, u2 }
 */
const emitListCollectionInitializer = (
  expr: Extract<IrExpression, { kind: "new" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  let currentContext = context;

  const [calleeFrag, calleeContext] = emitExpression(
    expr.callee,
    currentContext
  );
  currentContext = calleeContext;

  // Handle generic type arguments consistently with emitNew()
  let typeArgsStr = "";
  let finalClassName = calleeFrag.text;
  if (expr.typeArguments && expr.typeArguments.length > 0) {
    if (expr.requiresSpecialization) {
      const [specializedName, specContext] = generateSpecializedName(
        calleeFrag.text,
        expr.typeArguments,
        currentContext
      );
      finalClassName = specializedName;
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

  // Get the array literal argument
  const arrayLiteral = expr.arguments[0] as Extract<
    IrExpression,
    { kind: "array" }
  >;

  // Emit each element
  const elements: string[] = [];
  for (const element of arrayLiteral.elements) {
    if (element === undefined) {
      continue; // Skip undefined slots (sparse arrays)
    }
    if (element.kind === "spread") {
      // Not supported (guarded by isListConstructorWithArrayLiteral)
      const [fallbackFrag, fallbackContext] = emitNew(expr, currentContext);
      return [fallbackFrag, fallbackContext];
    } else {
      const [elemFrag, ctx] = emitExpression(element, currentContext);
      elements.push(elemFrag.text);
      currentContext = ctx;
    }
  }

  // Use collection initializer syntax
  const text =
    elements.length === 0
      ? `new ${finalClassName}${typeArgsStr}()`
      : `new ${finalClassName}${typeArgsStr} { ${elements.join(", ")} }`;

  return [{ text }, currentContext];
};

/**
 * Check if a new expression is new Array<T>(size)
 * Returns the element type if it is, undefined otherwise
 */
const isArrayConstructorCall = (
  expr: Extract<IrExpression, { kind: "new" }>
): boolean => {
  // Check if callee is identifier "Array"
  if (expr.callee.kind !== "identifier" || expr.callee.name !== "Array") {
    return false;
  }

  // Must have exactly one type argument
  if (!expr.typeArguments || expr.typeArguments.length !== 1) {
    return false;
  }

  return true;
};

/**
 * Emit new Array<T>(size) as new T[size]
 *
 * Examples:
 *   new Array<int>(10)     → new int[10]
 *   new Array<string>(5)   → new string[5]
 *   new Array<User>(count) → new User[count]
 *   new Array<int>()       → new int[0]
 */
const emitArrayConstructor = (
  expr: Extract<IrExpression, { kind: "new" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  let currentContext = context;

  // Get the element type (verified by isArrayConstructorCall)
  const typeArgs = expr.typeArguments;
  const elementType = typeArgs?.[0];
  if (!elementType) {
    return [{ text: "new object[0]" }, currentContext];
  }
  const [elementTypeStr, typeContext] = emitType(elementType, currentContext);
  currentContext = typeContext;

  // Get the size argument (if any)
  let sizeStr = "0"; // Default to empty array if no size argument
  if (expr.arguments.length > 0) {
    const sizeArg = expr.arguments[0];
    if (sizeArg && sizeArg.kind !== "spread") {
      const [sizeFrag, sizeContext] = emitExpression(sizeArg, currentContext);
      sizeStr = sizeFrag.text;
      currentContext = sizeContext;
    }
  }

  const text = `new ${elementTypeStr}[${sizeStr}]`;
  return [{ text }, currentContext];
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
 * as a C# generic type argument (union member, type argument, etc.).
 * C# forbids `void` as a generic type argument, so such types are invalid.
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
): [CSharpFragment, EmitterContext] => {
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

  // For void promises, track the resolve parameter name so call emitter
  // can strip arguments from resolve(undefined) calls (C# Action is zero-arg)
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

  // For void promises, the resolve parameter's TS type may be
  // `(value: void | PromiseLike<void>) => void` which emits as `Action<Union<void, Task>>` —
  // invalid in C# (void cannot be a generic type argument). Strip the type annotation only
  // when it contains void-in-generic, letting C# infer from the outer delegate cast.
  // When the type is clean (e.g., `() => void` → `Action`), keep it for clarity.
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

  const [executorFrag, executorContext] = emitExpression(
    emittedExecutor,
    executorEmitContext,
    expr.parameterTypes?.[0]
  );
  // Strip voidResolveNames from returned context to prevent leakage into enclosing scope
  currentContext = resolveParamName
    ? { ...executorContext, voidResolveNames: undefined }
    : executorContext;

  const executorText = formatPostfixExpressionText(executor, executorFrag.text);
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

  return [{ text }, currentContext];
};

/**
 * Emit a new expression
 */
export const emitNew = (
  expr: Extract<IrExpression, { kind: "new" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Special case: new Array<T>(size) → new T[size]
  if (isArrayConstructorCall(expr)) {
    return emitArrayConstructor(expr, context);
  }

  // Special case: new List<T>([...]) → new List<T> { ... }
  if (isListConstructorWithArrayLiteral(expr)) {
    return emitListCollectionInitializer(expr, context);
  }

  // Promise constructor lowering:
  //   new Promise<T>((resolve, reject) => { ... })
  // becomes a TaskCompletionSource<T>-backed Task expression.
  if (isPromiseConstructorCall(expr)) {
    return emitPromiseConstructor(expr, context);
  }

  const [calleeFrag, newContext] = emitExpression(expr.callee, context);
  let currentContext = newContext;

  // Handle generic type arguments
  let typeArgsStr = "";
  let finalClassName = calleeFrag.text;

  if (expr.typeArguments && expr.typeArguments.length > 0) {
    if (expr.requiresSpecialization) {
      // Monomorphisation: Generate specialized class name
      // e.g., new Box<string>() → new Box__string()
      const [specializedName, specContext] = generateSpecializedName(
        calleeFrag.text,
        expr.typeArguments,
        currentContext
      );
      finalClassName = specializedName;
      currentContext = specContext;
    } else {
      // Emit explicit type arguments for generic constructor
      // e.g., new Box<string>(value)
      const [typeArgs, typeContext] = emitTypeArguments(
        expr.typeArguments,
        currentContext
      );
      typeArgsStr = typeArgs;
      currentContext = typeContext;
    }
  }

  const args: string[] = [];
  const parameterTypes = expr.parameterTypes ?? [];
  for (let i = 0; i < expr.arguments.length; i++) {
    const arg = expr.arguments[i];
    if (!arg) continue;
    if (arg.kind === "spread") {
      const [spreadFrag, ctx] = emitExpression(arg.expression, currentContext);
      args.push(`params ${spreadFrag.text}`);
      currentContext = ctx;
    } else {
      const expectedType = parameterTypes[i];
      const castModifier = getPassingModifierFromCast(arg);
      if (castModifier && isLValue(arg)) {
        const [argFrag, ctx] = emitExpression(arg, currentContext);
        args.push(`${castModifier} ${argFrag.text}`);
        currentContext = ctx;
      } else {
        const [argFrag, ctx] = emitExpression(
          arg,
          currentContext,
          expectedType
        );
        const passingMode = expr.argumentPassing?.[i];
        const prefix =
          passingMode && passingMode !== "value" && isLValue(arg)
            ? `${passingMode} `
            : "";
        args.push(`${prefix}${argFrag.text}`);
        currentContext = ctx;
      }
    }
  }

  const text = `new ${finalClassName}${typeArgsStr}(${args.join(", ")})`;
  return [{ text }, currentContext];
};
