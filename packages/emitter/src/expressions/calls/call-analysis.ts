/**
 * Call expression analysis and detection helpers
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitTypeAst } from "../../type-emitter.js";
import { renderTypeAst } from "../../core/format/backend-ast/utils.js";
import { containsTypeParameter } from "../../core/semantic/type-resolution.js";

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
export const isLValue = (expr: IrExpression): boolean => {
  return expr.kind === "identifier" || expr.kind === "memberAccess";
};

/**
 * Check if an expression has an `as out<T>`, `as ref<T>`, or `as inref<T>` cast.
 * Returns the modifier ("out", "ref", "in") or undefined if not a passing modifier cast.
 *
 * When TypeScript code has `value as out<int>`, the frontend converts this to
 * an expression with `inferredType: { kind: "referenceType", name: "out", ... }`.
 */
export const getPassingModifierFromCast = (
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
export const isJsonSerializerCall = (
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
export const isGlobalJsonCall = (
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
export const isInstanceMemberAccess = (
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
export const shouldEmitFluentExtensionCall = (
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

export const getTypeNamespace = (typeName: string): string | undefined => {
  const lastDot = typeName.lastIndexOf(".");
  if (lastDot <= 0) return undefined;
  return typeName.slice(0, lastDot);
};

/**
 * Whether a C# type string is a builtin/keyword type (optionally nullable).
 *
 * These must NOT be qualified with a namespace (e.g. `object`, not `MyNs.object`).
 */
export const isCSharpBuiltinType = (typeStr: string): boolean => {
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
export const ensureGlobalPrefix = (typeStr: string): string => {
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
export const registerJsonAotType = (
  type: IrType | undefined,
  context: EmitterContext
): void => {
  if (!type) return;
  if (!context.options.jsonAotRegistry) return;

  // NativeAOT JSON source generation requires CLOSED types.
  // If the type contains any generic parameters in the current scope (T, U, ...),
  // we cannot emit `[JsonSerializable(typeof(T))]` because `T` is not in scope in the
  // generated context class. Skip registration to keep emission valid.
  if (containsTypeParameter(type)) {
    context.options.jsonAotRegistry.needsJsonAot = true;
    return;
  }

  const registry = context.options.jsonAotRegistry;
  const [rawTypeAst] = emitTypeAst(type, {
    ...context,
    qualifyLocalTypes: true,
  });
  const rawTypeStr = renderTypeAst(rawTypeAst);
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
export const needsIntCast = (
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

const PROMISE_CHAIN_METHODS = new Set(["then", "catch", "finally"]);

export const isPromiseChainMethod = (name: string): boolean =>
  PROMISE_CHAIN_METHODS.has(name);
