/**
 * Call and new expression emitters
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "../types.js";
import { emitExpression } from "../expression-emitter.js";
import { emitTypeArguments, generateSpecializedName } from "./identifiers.js";
import { emitType } from "../type-emitter.js";

/**
 * Ref/out/in parameter handling:
 * The frontend extracts parameter passing modes from resolved signatures
 * and attaches them to IrCallExpression.argumentPassing array.
 * The emitter reads this array and prefixes arguments with ref/out/in keywords.
 */

/**
 * Check if an expression is an lvalue (can be passed by reference)
 * Only identifiers and member accesses are lvalues in C#
 */
const isLValue = (expr: IrExpression): boolean => {
  return expr.kind === "identifier" || expr.kind === "memberAccess";
};

/**
 * Check if an expression has an `as out<T>`, `as ref<T>`, or `as inref<T>` cast.
 * Returns the modifier ("out", "ref", "in") or undefined if not a passing modifier cast.
 *
 * When TypeScript code has `value as out<int>`, the frontend converts this to
 * an expression with `inferredType: { kind: "referenceType", name: "out", ... }`.
 */
const getPassingModifierFromCast = (
  expr: IrExpression
): "out" | "ref" | "in" | undefined => {
  const inferredType = expr.inferredType;
  if (!inferredType || inferredType.kind !== "referenceType") {
    return undefined;
  }

  const typeName = inferredType.name;
  if (typeName === "out") return "out";
  if (typeName === "ref") return "ref";
  if (typeName === "inref") return "in"; // inref maps to C# 'in' keyword

  return undefined;
};

/**
 * Check if a member access expression targets System.Text.Json.JsonSerializer
 */
const isJsonSerializerCall = (
  callee: IrExpression
): { method: "Serialize" | "Deserialize" } | null => {
  if (callee.kind !== "memberAccess") return null;
  if (!callee.memberBinding) return null;

  const { type, member } = callee.memberBinding;

  // Check if this is System.Text.Json.JsonSerializer
  if (type !== "System.Text.Json.JsonSerializer") return null;

  // Check if the member is Serialize or Deserialize
  if (member === "Serialize") return { method: "Serialize" };
  if (member === "Deserialize") return { method: "Deserialize" };

  return null;
};

/**
 * Check if a call targets global JSON.stringify or JSON.parse
 * These global JSON methods compile to JsonSerializer
 */
const isGlobalJsonCall = (
  callee: IrExpression
): { method: "Serialize" | "Deserialize" } | null => {
  if (callee.kind !== "memberAccess") return null;

  // Check if object is the global JSON identifier
  const obj = callee.object;
  if (obj.kind !== "identifier" || obj.name !== "JSON") return null;

  // Check property name
  const prop = callee.property;
  if (typeof prop !== "string") return null;

  if (prop === "stringify") return { method: "Serialize" };
  if (prop === "parse") return { method: "Deserialize" };

  return null;
};

/**
 * Heuristic: Determine if a member access is an instance-style access (receiver.value)
 * vs a static type reference (Type.Member).
 *
 * This mirrors the logic in emitMemberAccess; extension-method lowering only applies
 * to instance-style member accesses.
 */
const isInstanceMemberAccess = (
  expr: Extract<IrExpression, { kind: "memberAccess" }>,
  context: EmitterContext
): boolean => {
  // Imported types (e.g., `Enumerable.Where(...)`) are static receiver expressions,
  // even if TypeScript assigns them an inferredType.
  if (expr.object.kind === "identifier") {
    const importBinding = context.importBindings?.get(expr.object.name);
    if (importBinding?.kind === "type") {
      return false;
    }
  }

  const objectType = expr.object.inferredType;
  return (
    objectType?.kind === "referenceType" ||
    objectType?.kind === "arrayType" ||
    objectType?.kind === "intersectionType" ||
    objectType?.kind === "unionType" ||
    objectType?.kind === "primitiveType" ||
    objectType?.kind === "literalType"
  );
};

/**
 * Whether a C# type string is a builtin/keyword type (optionally nullable).
 *
 * These must NOT be qualified with a namespace (e.g. `object`, not `MyNs.object`).
 */
const isCSharpBuiltinType = (typeStr: string): boolean => {
  const base = typeStr.endsWith("?") ? typeStr.slice(0, -1) : typeStr;
  return (
    base === "string" ||
    base === "int" ||
    base === "long" ||
    base === "short" ||
    base === "byte" ||
    base === "sbyte" ||
    base === "uint" ||
    base === "ulong" ||
    base === "ushort" ||
    base === "float" ||
    base === "double" ||
    base === "decimal" ||
    base === "bool" ||
    base === "char" ||
    base === "object" ||
    base === "void"
  );
};

/**
 * Ensure a C# type string has global:: prefix for unambiguous resolution
 */
const ensureGlobalPrefix = (typeStr: string): string => {
  // Skip primitives and already-prefixed types
  if (typeStr.startsWith("global::") || isCSharpBuiltinType(typeStr)) {
    return typeStr;
  }

  // Handle generic types: List<Foo> -> global::List<global::Foo>
  // For now, just add prefix to the outer type
  // The inner types should already be handled by emitType
  return `global::${typeStr}`;
};

/**
 * Register a type with the JSON AOT registry.
 * Ensures types are fully qualified with namespace for the AOT source generator.
 */
const registerJsonAotType = (
  type: IrType | undefined,
  context: EmitterContext
): void => {
  if (!type) return;
  if (!context.options.jsonAotRegistry) return;

  const registry = context.options.jsonAotRegistry;
  const [rawTypeStr] = emitType(type, context);
  const typeStr = rawTypeStr.endsWith("?")
    ? rawTypeStr.slice(0, -1)
    : rawTypeStr;

  // If type already has a namespace (contains '.') or is global::, use as-is
  // Otherwise, qualify with rootNamespace (it's a local type)
  let qualifiedType: string;
  if (
    isCSharpBuiltinType(typeStr) ||
    typeStr.startsWith("global::") ||
    typeStr.includes(".") ||
    typeStr.includes("<") // Generic types handle their own qualification
  ) {
    qualifiedType = ensureGlobalPrefix(typeStr);
  } else {
    // Local type - qualify with rootNamespace
    const rootNs = context.options.rootNamespace;
    qualifiedType = `global::${rootNs}.${typeStr}`;
  }

  registry.rootTypes.add(qualifiedType);
  registry.needsJsonAot = true;
};

/**
 * Check if a call expression needs an explicit cast because the inferred type
 * differs from the C# return type. This handles cases like Math.floor() which
 * returns double in C# but is cast to int in TypeScript via `as int`.
 */
const needsIntCast = (
  expr: Extract<IrExpression, { kind: "call" }>,
  calleeName: string
): boolean => {
  // Check if the inferred type is int (a reference type from @tsonic/core)
  const inferredType = expr.inferredType;
  if (
    !inferredType ||
    inferredType.kind !== "referenceType" ||
    inferredType.name !== "int"
  ) {
    return false;
  }

  // Check if this is a Math method that returns double
  const mathMethodsReturningDouble = [
    "Math.floor",
    "Math.ceil",
    "Math.round",
    "Math.abs",
    "Math.pow",
    "Math.sqrt",
    "Math.min",
    "Math.max",
  ];

  return mathMethodsReturningDouble.some(
    (m) => calleeName === m || calleeName.endsWith(`.${m.split(".").pop()}`)
  );
};

/**
 * Emit a JsonSerializer call with NativeAOT-compatible options.
 * Rewrites:
 *   JsonSerializer.Serialize(value) → JsonSerializer.Serialize(value, TsonicJson.Options)
 *   JsonSerializer.Deserialize<T>(json) → JsonSerializer.Deserialize<T>(json, TsonicJson.Options)
 */
const emitJsonSerializerCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext,
  method: "Serialize" | "Deserialize"
): [CSharpFragment, EmitterContext] => {
  let currentContext = context;

  // Register the type with the JSON AOT registry
  if (method === "Serialize") {
    // For Serialize, get type from first argument's inferredType
    const firstArg = expr.arguments[0];
    if (firstArg && firstArg.kind !== "spread") {
      registerJsonAotType(firstArg.inferredType, context);
    }
  } else {
    // For Deserialize, get type from type arguments
    const typeArg = expr.typeArguments?.[0];
    if (typeArg) {
      registerJsonAotType(typeArg, context);
    }
  }

  // Emit type arguments for Deserialize<T>
  let typeArgsStr = "";
  if (expr.typeArguments && expr.typeArguments.length > 0) {
    const [typeArgs, typeContext] = emitTypeArguments(
      expr.typeArguments,
      currentContext
    );
    typeArgsStr = typeArgs;
    currentContext = typeContext;
  }

  // Emit arguments
  const args: string[] = [];
  for (const arg of expr.arguments) {
    if (arg.kind === "spread") {
      const [spreadFrag, ctx] = emitExpression(arg.expression, currentContext);
      args.push(spreadFrag.text);
      currentContext = ctx;
    } else {
      const [argFrag, ctx] = emitExpression(arg, currentContext);
      args.push(argFrag.text);
      currentContext = ctx;
    }
  }

  // Add TsonicJson.Options as the last argument for NativeAOT compatibility
  args.push("TsonicJson.Options");

  const text = `global::System.Text.Json.JsonSerializer.${method}${typeArgsStr}(${args.join(", ")})`;
  return [{ text }, currentContext];
};

/**
 * Emit a function call expression
 */
export const emitCall = (
  expr: Extract<IrExpression, { kind: "call" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Check for JsonSerializer calls (NativeAOT support)
  const jsonCall = isJsonSerializerCall(expr.callee);
  if (jsonCall) {
    return emitJsonSerializerCall(expr, context, jsonCall.method);
  }

  // Check for global JSON.stringify/parse calls
  // These compile to JsonSerializer.Serialize/Deserialize
  const globalJsonCall = isGlobalJsonCall(expr.callee);
  if (globalJsonCall) {
    return emitJsonSerializerCall(expr, context, globalJsonCall.method);
  }

  // Extension method lowering: emit explicit static invocation with receiver as first arg.
  // This avoids relying on C# `using` directives for extension method discovery.
  if (
    expr.callee.kind === "memberAccess" &&
    expr.callee.memberBinding?.isExtensionMethod &&
    isInstanceMemberAccess(expr.callee, context)
  ) {
    let currentContext = context;

    const binding = expr.callee.memberBinding;
    const receiverExpr = expr.callee.object;

    const [receiverFrag, receiverContext] = emitExpression(
      receiverExpr,
      currentContext
    );
    currentContext = receiverContext;

    let finalCalleeName = `global::${binding.type}.${binding.member}`;

    // Handle generic type arguments
    let typeArgsStr = "";
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
        const [typeArgs, typeContext] = emitTypeArguments(
          expr.typeArguments,
          currentContext
        );
        typeArgsStr = typeArgs;
        currentContext = typeContext;
      }
    }

    const parameterTypes = expr.parameterTypes ?? [];
    const args: string[] = [receiverFrag.text];

    for (let i = 0; i < expr.arguments.length; i++) {
      const arg = expr.arguments[i];
      if (!arg) continue;

      const expectedType = parameterTypes[i];

      if (arg.kind === "spread") {
        const [spreadFrag, ctx] = emitExpression(arg.expression, currentContext);
        args.push(`params ${spreadFrag.text}`);
        currentContext = ctx;
      } else {
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

    const baseCallText = `${finalCalleeName}${typeArgsStr}(${args.join(", ")})`;

    // JS runtime helpers often return List<T> for array-like results, while the IR
    // models them as native CLR arrays. When the IR expects an array, coerce via
    // Enumerable.ToArray to preserve the IR contract.
    const callText =
      expr.inferredType?.kind === "arrayType"
        ? `global::System.Linq.Enumerable.ToArray(${baseCallText})`
        : baseCallText;

    const text = needsIntCast(expr, finalCalleeName)
      ? `(int)${callText}`
      : callText;
    return [{ text }, currentContext];
  }

  // Regular function call
  const [calleeFrag, newContext] = emitExpression(expr.callee, context);
  let currentContext = newContext;

  // Handle generic type arguments
  let typeArgsStr = "";
  let finalCalleeName = calleeFrag.text;

  if (expr.typeArguments && expr.typeArguments.length > 0) {
    if (expr.requiresSpecialization) {
      // Monomorphisation: Generate specialized method name
      // e.g., process<string> → process__string
      const [specializedName, specContext] = generateSpecializedName(
        calleeFrag.text,
        expr.typeArguments,
        currentContext
      );
      finalCalleeName = specializedName;
      currentContext = specContext;
    } else {
      // Emit explicit type arguments for generic call
      // e.g., identity<string>(value)
      const [typeArgs, typeContext] = emitTypeArguments(
        expr.typeArguments,
        currentContext
      );
      typeArgsStr = typeArgs;
      currentContext = typeContext;
    }
  }

  // Get parameter types from IR (extracted from resolved signature in frontend)
  const parameterTypes = expr.parameterTypes ?? [];

  const args: string[] = [];
  for (let i = 0; i < expr.arguments.length; i++) {
    const arg = expr.arguments[i];
    if (!arg) continue; // Skip undefined (shouldn't happen in valid IR)

    // Get expected type for this argument from parameter types
    const expectedType = parameterTypes[i];

    if (arg.kind === "spread") {
      // Spread in function call
      const [spreadFrag, ctx] = emitExpression(arg.expression, currentContext);
      args.push(`params ${spreadFrag.text}`);
      currentContext = ctx;
    } else {
      // Check if this argument has an explicit `as out<T>` / `as ref<T>` / `as inref<T>` cast
      const castModifier = getPassingModifierFromCast(arg);

      if (castModifier && isLValue(arg)) {
        // Emit the expression without the cast wrapper, with the modifier prefix
        // For `value as out<int>`, emit `out value`
        const [argFrag, ctx] = emitExpression(arg, currentContext);
        args.push(`${castModifier} ${argFrag.text}`);
        currentContext = ctx;
      } else {
        const [argFrag, ctx] = emitExpression(
          arg,
          currentContext,
          expectedType
        );
        // Check if this argument needs ref/out/in prefix from function signature
        // Only add prefix if argument is an lvalue (identifier or member access)
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

  const callOp = expr.isOptional ? "?." : "";
  const callText = `${finalCalleeName}${typeArgsStr}${callOp}(${args.join(", ")})`;

  // Add cast if needed (e.g., Math.floor returning double but asserted as int)
  const text = needsIntCast(expr, finalCalleeName)
    ? `(int)${callText}`
    : callText;

  return [{ text }, currentContext];
};

/**
 * Check if a new expression is new List<T>([...]) with an array literal argument
 * This pattern should be emitted as collection initializer: new List<T> { ... }
 */
const isListConstructorWithArrayLiteral = (
  expr: Extract<IrExpression, { kind: "new" }>
): boolean => {
  // Check if callee is identifier "List"
  if (expr.callee.kind !== "identifier" || expr.callee.name !== "List") {
    return false;
  }

  // Must have exactly one type argument
  if (!expr.typeArguments || expr.typeArguments.length !== 1) {
    return false;
  }

  // Must have exactly one argument that is an array literal
  if (expr.arguments.length !== 1) {
    return false;
  }

  const arg = expr.arguments[0];
  if (!arg || arg.kind === "spread") {
    return false;
  }

  // The argument must be an array literal
  return arg.kind === "array";
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

  // Get the element type (verified by isListConstructorWithArrayLiteral)
  const typeArgs = expr.typeArguments;
  const elementType = typeArgs?.[0];
  if (!elementType) {
    return [{ text: "new List<object>()" }, currentContext];
  }
  const [elementTypeStr, typeContext] = emitType(elementType, currentContext);
  currentContext = typeContext;

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
      // Spread in collection initializer - not supported, fall back to constructor
      // This shouldn't happen in well-formed code, but handle gracefully
      const [spreadFrag, ctx] = emitExpression(
        element.expression,
        currentContext
      );
      elements.push(`..${spreadFrag.text}`);
      currentContext = ctx;
    } else {
      const [elemFrag, ctx] = emitExpression(element, currentContext);
      elements.push(elemFrag.text);
      currentContext = ctx;
    }
  }

  // Use collection initializer syntax
  const text =
    elements.length === 0
      ? `new List<${elementTypeStr}>()`
      : `new List<${elementTypeStr}> { ${elements.join(", ")} }`;

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
  for (const arg of expr.arguments) {
    if (arg.kind === "spread") {
      const [spreadFrag, ctx] = emitExpression(arg.expression, currentContext);
      args.push(`params ${spreadFrag.text}`);
      currentContext = ctx;
    } else {
      const [argFrag, ctx] = emitExpression(arg, currentContext);
      args.push(argFrag.text);
      currentContext = ctx;
    }
  }

  const text = `new ${finalClassName}${typeArgsStr}(${args.join(", ")})`;
  return [{ text }, currentContext];
};
