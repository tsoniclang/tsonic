/**
 * Call and new expression emitters
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "../types.js";
import { emitExpression } from "../expression-emitter.js";
import { emitTypeArguments, generateSpecializedName } from "./identifiers.js";
import { emitType } from "../type-emitter.js";
import { formatPostfixExpressionText } from "./parentheses.js";
import { emitMemberAccess } from "./access.js";
import { containsTypeParameter } from "../core/type-resolution.js";

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

    // If this isn't an import and we don't have a receiver type, default to instance.
    // This matches emitMemberAccess's behavior and prevents local variables from being
    // misclassified as static type receivers (which breaks extension method lowering).
    if (!expr.object.inferredType) {
      return true;
    }
  }

  const objectType = expr.object.inferredType;
  return (
    objectType?.kind === "referenceType" ||
    objectType?.kind === "arrayType" ||
    objectType?.kind === "intersectionType" ||
    objectType?.kind === "unionType" ||
    objectType?.kind === "primitiveType" ||
    objectType?.kind === "literalType" ||
    objectType?.kind === "typeParameterType" ||
    objectType?.kind === "unknownType"
  );
};

/**
 * Whether to emit an extension method call using fluent instance syntax (receiver.Method(...))
 * instead of explicit static invocation (Type.Method(receiver, ...)).
 *
 * Default: prefer static invocation to avoid relying on `using` directives and to avoid
 * accidental binding to an instance member when a type has both an instance method and
 * an extension method with the same name.
 *
 * Exception: certain toolchains (notably EF query precompilation) require the *syntax*
 * of extension-method invocation so the analyzer can locate queries in user code.
 */
const shouldEmitFluentExtensionCall = (
  bindingType: string,
  memberName: string
): boolean => {
  // EF Core query precompilation requires fluent/extension syntax specifically for Queryable.
  // Keep Enumerable as explicit static invocation by default to avoid accidental binding to
  // instance methods on custom enumerable types.
  if (bindingType.startsWith("System.Linq.Queryable")) return true;

  // EF Core query operators (Include/ThenInclude/AsNoTracking/etc.)
  if (bindingType.startsWith("Microsoft.EntityFrameworkCore.")) return true;

  // EF Core query precompilation also requires fluent syntax for certain Enumerable terminal ops
  // (e.g., IQueryable<T>.ToList()/ToArray()). When emitted as explicit static calls
  // (Enumerable.ToList(query)), dotnet-ef may not generate interceptors, causing runtime failure
  // under NativeAOT ("Query wasn't precompiled and dynamic code isn't supported").
  if (
    bindingType.startsWith("System.Linq.Enumerable") &&
    (memberName === "ToList" || memberName === "ToArray")
  ) {
    return true;
  }

  return false;
};

const getTypeNamespace = (typeName: string): string | undefined => {
  const lastDot = typeName.lastIndexOf(".");
  if (lastDot <= 0) return undefined;
  return typeName.slice(0, lastDot);
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
  // Skip already-prefixed types
  if (typeStr.startsWith("global::")) {
    return typeStr;
  }

  // Handle pointer types (T*). `global::int*` is invalid; qualify the element type only.
  if (typeStr.endsWith("*")) {
    const inner = typeStr.slice(0, -1);
    return `${ensureGlobalPrefix(inner)}*`;
  }

  // Handle arrays (T[], T[,], jagged arrays, ...). `global::string[]` is invalid; qualify
  // the element type only.
  const arrayMatch = /(\[[,\s]*\])$/.exec(typeStr);
  if (arrayMatch) {
    const suffix = arrayMatch[1];
    if (!suffix) return typeStr;
    const inner = typeStr.slice(0, -suffix.length);
    return `${ensureGlobalPrefix(inner)}${suffix}`;
  }

  // Skip primitives (and other builtin keyword types) after handling suffix forms.
  if (isCSharpBuiltinType(typeStr)) {
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

  // NativeAOT JSON source generation requires CLOSED types.
  // If the type contains any generic parameters in the current scope (T, U, ...),
  // we cannot emit `[JsonSerializable(typeof(T))]` because `T` is not in scope in the
  // generated context class. Skip registration to keep emission valid.
  if (containsTypeParameter(type, context.typeParameters ?? new Set())) {
    context.options.jsonAotRegistry.needsJsonAot = true;
    return;
  }

  const registry = context.options.jsonAotRegistry;
  const [rawTypeStr] = emitType(type, { ...context, qualifyLocalTypes: true });
  const typeStr = rawTypeStr.endsWith("?")
    ? rawTypeStr.slice(0, -1)
    : rawTypeStr;

  registry.rootTypes.add(ensureGlobalPrefix(typeStr));
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

  // Add TsonicJson.Options only when NativeAOT JSON context generation is enabled.
  if (context.options.jsonAotRegistry) {
    args.push("TsonicJson.Options");
  }

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

  // EF Core query precompilation has a known limitation: `query.ToList().ToArray()`
  // fails to precompile (captured locals may be treated as "unknown identifiers").
  // Since `ToList().ToArray()` is equivalent to `ToArray()` for IEnumerable<T>,
  // canonicalize this pattern to `query.ToArray()` so NativeAOT precompilation works.
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

      // Ensure extension methods are in scope.
      currentContext.usings.add("System.Linq");

      const receiverExpr = innerCall.callee.object;
      const [receiverFrag, receiverCtx] = emitExpression(
        receiverExpr,
        currentContext
      );
      currentContext = receiverCtx;

      const receiverText = formatPostfixExpressionText(
        receiverExpr,
        receiverFrag.text
      );

      const text = `${receiverText}.ToArray()`;
      return [{ text }, currentContext];
    }
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

    // Some ecosystems (notably EF Core query precompilation) require fluent syntax
    // so the tooling can locate queries in syntax trees. For those namespaces,
    // emit `receiver.Method(...)` and add a `using` directive for the namespace.
    if (shouldEmitFluentExtensionCall(binding.type, binding.member)) {
      const ns = getTypeNamespace(binding.type);
      if (ns) {
        currentContext.usings.add(ns);
      }

      // Handle generic type arguments
      let typeArgsStr = "";
      if (expr.typeArguments && expr.typeArguments.length > 0) {
        const [typeArgs, typeContext] = emitTypeArguments(
          expr.typeArguments,
          currentContext
        );
        typeArgsStr = typeArgs;
        currentContext = typeContext;
      }

      // Get parameter types from IR (extracted from resolved signature in frontend)
      const parameterTypes = expr.parameterTypes ?? [];

      const args: string[] = [];
      for (let i = 0; i < expr.arguments.length; i++) {
        const arg = expr.arguments[i];
        if (!arg) continue;

        const expectedType = parameterTypes[i];

        if (arg.kind === "spread") {
          const [spreadFrag, ctx] = emitExpression(
            arg.expression,
            currentContext
          );
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

      const receiverText = formatPostfixExpressionText(
        receiverExpr,
        receiverFrag.text
      );
      const op = expr.isOptional ? "?." : ".";
      const baseCallText = `${receiverText}${op}${binding.member}${typeArgsStr}(${args.join(", ")})`;

      const text = needsIntCast(expr, binding.member)
        ? `(int)${baseCallText}`
        : baseCallText;
      return [{ text }, currentContext];
    }

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
        const [spreadFrag, ctx] = emitExpression(
          arg.expression,
          currentContext
        );
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
  const [calleeFrag, newContext] =
    expr.callee.kind === "memberAccess"
      ? emitMemberAccess(expr.callee, context, "call")
      : emitExpression(expr.callee, context);
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

  // For member-access calls, the receiver parenthesization is already handled inside
  // `emitMemberAccess`. Wrapping the full `obj.Member` in parentheses can change meaning
  // in C# (e.g., `(obj.Member)()` attempts to invoke a delegate rather than calling a method).
  const calleeText =
    expr.callee.kind === "memberAccess"
      ? `${finalCalleeName}${typeArgsStr}`
      : formatPostfixExpressionText(
          expr.callee,
          `${finalCalleeName}${typeArgsStr}`
        );

  const callOp = expr.isOptional ? "?." : "";
  const callText = `${calleeText}${callOp}(${args.join(", ")})`;

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

  const [executorFrag, executorContext] = emitExpression(
    executor,
    currentContext,
    expr.parameterTypes?.[0]
  );
  currentContext = executorContext;

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
