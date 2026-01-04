/**
 * Reference type emission (Array, Promise, Error, etc.)
 *
 * All types are emitted with global:: prefix for unambiguous resolution.
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitType } from "./emitter.js";
import {
  isNestedType,
  tsCSharpNestedTypeName,
} from "@tsonic/frontend/types/nested-types.js";
import { substituteTypeArgs } from "../core/type-resolution.js";

/**
 * C# primitive type names that can be emitted directly without qualification.
 * These correspond to the types defined in @tsonic/core package.
 */
const CSHARP_PRIMITIVES = new Set([
  // Signed integers (from @tsonic/core)
  "sbyte",
  "short",
  "int",
  "long",
  "nint",
  "int128",
  // Unsigned integers (from @tsonic/core)
  "byte",
  "ushort",
  "uint",
  "ulong",
  "nuint",
  "uint128",
  // Floating-point (from @tsonic/core)
  "half",
  "float",
  "double",
  "decimal",
  // Other primitives (from @tsonic/core)
  "bool",
  "char",
  // Additional C# keywords that are valid type names
  "string",
  "object",
  "void",
]);

/**
 * Normalize a CLR type name to global:: format
 */
const toGlobalClr = (clr: string): string => {
  const trimmed = clr.trim();
  return trimmed.startsWith("global::") ? trimmed : `global::${trimmed}`;
};

/**
 * Extract CLR name from a binding object.
 * Handles both tsbindgen format (clrName) and internal format (name).
 */
const getBindingClrName = (b: unknown): string | undefined => {
  if (!b || typeof b !== "object") return undefined;

  // tsbindgen TypeBinding: { clrName: "System.Action", tsEmitName: "Action", ... }
  const maybeClrName = (b as { clrName?: unknown }).clrName;
  if (typeof maybeClrName === "string" && maybeClrName.length > 0) {
    return maybeClrName;
  }

  // internal TypeBinding: { name: "System.Console", alias: "Console", ... }
  const maybeName = (b as { name?: unknown }).name;
  if (typeof maybeName === "string" && maybeName.length > 0) {
    return maybeName;
  }

  return undefined;
};

/**
 * Convert CLR metadata type names into C#-emittable type names.
 *
 * tsbindgen bindings use CLR "full names" that include:
 * - Generic arity markers: `Dictionary`2`, `Func`3`, etc.
 * - Nested type separators: `Outer+Inner`
 *
 * C# source code must not include arity markers, and nested types use `.`
 * in source (e.g. `Outer.Inner`).
 */
const clrTypeNameToCSharp = (clr: string): string => {
  const prefix = "global::";
  const hasGlobal = clr.startsWith(prefix);
  const body = hasGlobal ? clr.slice(prefix.length) : clr;

  const sanitized = body
    // Strip generic arity markers (e.g. Dictionary`2 -> Dictionary)
    .replace(/`\d+/g, "")
    // CLR nested types use '+'; C# source uses '.'
    .replace(/\+/g, ".");

  return hasGlobal ? `${prefix}${sanitized}` : sanitized;
};

/**
 * Check if a type name indicates an unsupported support type.
 *
 * NOTE: The emitter does not have access to the TypeScript checker. Support types
 * should be rejected during frontend IR building. This is a defensive guard in case
 * unsupported types leak into IR.
 */
const checkUnsupportedSupportType = (typeName: string): string | undefined => {
  if (
    typeName === "TSUnsafePointer" ||
    typeName.startsWith("TSUnsafePointer<")
  ) {
    return "Unsafe pointers are not supported in Tsonic. Use IntPtr for opaque handles.";
  }
  if (typeName === "TSFixed" || typeName.startsWith("TSFixed<")) {
    return "Fixed-size buffers (unsafe feature) are not supported. Use arrays or Span<T> instead.";
  }
  if (typeName === "TSStackAlloc" || typeName.startsWith("TSStackAlloc<")) {
    return "stackalloc is not supported in Tsonic. Use heap-allocated arrays instead.";
  }
  return undefined;
};

/**
 * Emit reference types with type arguments
 */
export const emitReferenceType = (
  type: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const { name, typeArguments, resolvedClrType } = type;

  // Check if this is a local type alias for a tuple type - must resolve since C# has no type alias for ValueTuple
  // Tuple type aliases: RESOLVE to ValueTuple<...> (C# has no equivalent type alias syntax)
  // Union/intersection type aliases: PRESERVE names for readability (emitted as comments elsewhere)
  // Object type aliases: PRESERVE names (emitted as classes)
  const typeInfo = context.localTypes?.get(name);
  if (typeInfo && typeInfo.kind === "typeAlias") {
    const underlyingKind = typeInfo.type.kind;
    // Only resolve tuple type aliases - all others preserve their names
    const shouldResolve = underlyingKind === "tupleType";

    if (shouldResolve) {
      // Substitute type arguments if present
      const underlyingType =
        typeArguments && typeArguments.length > 0
          ? substituteTypeArgs(
              typeInfo.type,
              typeInfo.typeParameters,
              typeArguments
            )
          : typeInfo.type;
      return emitType(underlyingType, context);
    }
    // For union types, object types, etc. - fall through and emit the alias name
  }

  // If the type has a pre-resolved CLR type (from IR), use it
  if (resolvedClrType) {
    const qualifiedClr = CSHARP_PRIMITIVES.has(resolvedClrType)
      ? resolvedClrType
      : toGlobalClr(resolvedClrType);
    if (typeArguments && typeArguments.length > 0) {
      const typeParams: string[] = [];
      let currentContext = context;
      for (const typeArg of typeArguments) {
        const [paramType, newContext] = emitType(typeArg, currentContext);
        typeParams.push(paramType);
        currentContext = newContext;
      }
      return [`${qualifiedClr}<${typeParams.join(", ")}>`, currentContext];
    }
    return [qualifiedClr, context];
  }

  // Check if this type is imported - use pre-computed CLR name directly
  const importBinding = context.importBindings?.get(name);
  if (importBinding) {
    // Use clrName directly - all resolution was done when building the binding
    // For type imports: clrName is the type's FQN (e.g., "MultiFileTypes.models.User")
    // For value imports: clrName is container, member is the export name
    // Note: Type references should only match type bindings; value bindings
    // appearing here would be a bug (referencing a function as a type)
    const qualifiedName =
      importBinding.kind === "type"
        ? importBinding.clrName
        : importBinding.member
          ? `${importBinding.clrName}.${importBinding.member}`
          : importBinding.clrName;

    if (typeArguments && typeArguments.length > 0) {
      const typeParams: string[] = [];
      let currentContext = context;
      for (const typeArg of typeArguments) {
        const [paramType, newContext] = emitType(typeArg, currentContext);
        typeParams.push(paramType);
        currentContext = newContext;
      }
      return [`${qualifiedName}<${typeParams.join(", ")}>`, currentContext];
    }
    return [qualifiedName, context];
  }

  // Check for unsupported support types
  const unsupportedError = checkUnsupportedSupportType(name);
  if (unsupportedError) {
    throw new Error(`[Tsonic] ${unsupportedError}`);
  }

  // Handle built-in types
  // Array<T> emits as native T[] array, same as T[] syntax
  // Users must explicitly use List<T> to get a List
  if (name === "Array" && typeArguments && typeArguments.length > 0) {
    const firstArg = typeArguments[0];
    if (!firstArg) {
      return [`object[]`, context];
    }
    const [elementType, newContext] = emitType(firstArg, context);
    return [`${elementType}[]`, newContext];
  }

  if (name === "Promise" && typeArguments && typeArguments.length > 0) {
    const firstArg = typeArguments[0];
    if (!firstArg) {
      return [`global::System.Threading.Tasks.Task`, context];
    }
    const [elementType, newContext] = emitType(firstArg, context);
    // Promise<void> should map to Task (not Task<void>)
    if (elementType === "void") {
      return [`global::System.Threading.Tasks.Task`, newContext];
    }
    return [`global::System.Threading.Tasks.Task<${elementType}>`, newContext];
  }

  if (name === "Promise") {
    return ["global::System.Threading.Tasks.Task", context];
  }

  // Map core Span<T> to System.Span<T>.
  // This is used by stackalloc<T>(n) and other span-based APIs.
  if (name === "Span") {
    if (!typeArguments || typeArguments.length !== 1) {
      throw new Error(
        `ICE: Span must have exactly 1 type argument, got ${typeArguments?.length ?? 0}`
      );
    }
    const inner = typeArguments[0];
    if (!inner) {
      throw new Error("ICE: Span<T> missing type argument");
    }
    const [innerType, newContext] = emitType(inner, context);
    return [`global::System.Span<${innerType}>`, newContext];
  }

  // Map core ptr<T> to C# unsafe pointer type: T*
  if (name === "ptr") {
    if (!typeArguments || typeArguments.length !== 1) {
      throw new Error(
        `ICE: ptr must have exactly 1 type argument, got ${typeArguments?.length ?? 0}`
      );
    }
    const inner = typeArguments[0];
    if (!inner) {
      throw new Error("ICE: ptr<T> missing type argument");
    }
    const [innerType, newContext] = emitType(inner, context);
    return [`${innerType}*`, newContext];
  }

  // NOTE: Map and Set must be explicitly imported (not ambient)

  // Map PromiseLike to Task
  if (name === "PromiseLike") {
    // PromiseLike is in both globals packages - safe to map unconditionally
    return ["global::System.Threading.Tasks.Task", context];
  }

  // C# primitive types can be emitted directly
  if (CSHARP_PRIMITIVES.has(name)) {
    return [name, context];
  }

  // Type parameters in scope can be emitted directly
  if (context.typeParameters?.has(name)) {
    return [name, context];
  }

  // IMPORTANT: Check local types BEFORE binding registry.
  // Local types take precedence over .NET types with the same name.
  // This ensures that a locally defined `Container<T>` is not resolved
  // to `System.ComponentModel.Container` from the binding registry.
  const localTypeInfo = context.localTypes?.get(name);
  if (localTypeInfo) {
    // Convert nested type names (Outer$Inner → Outer.Inner)
    let csharpName = isNestedType(name) ? tsCSharpNestedTypeName(name) : name;

    // Type aliases with objectType underlying type are emitted as classes with __Alias suffix
    // (per spec/16-types-and-interfaces.md §3.4)
    if (
      localTypeInfo.kind === "typeAlias" &&
      localTypeInfo.type.kind === "objectType"
    ) {
      csharpName = `${csharpName}__Alias`;
    }

    if (typeArguments && typeArguments.length > 0) {
      const typeParams: string[] = [];
      let currentContext = context;

      for (const typeArg of typeArguments) {
        const [paramType, newContext] = emitType(typeArg, currentContext);
        typeParams.push(paramType);
        currentContext = newContext;
      }

      return [`${csharpName}<${typeParams.join(", ")}>`, currentContext];
    }

    return [csharpName, context];
  }

  // Resolve external types via binding registry (must be fully qualified)
  // This handles types from contextual inference (e.g., Action from Parallel.invoke)
  // IMPORTANT: This is checked AFTER localTypes to ensure local types take precedence
  const regBinding = context.bindingsRegistry?.get(name);
  if (regBinding) {
    const clr = getBindingClrName(regBinding);
    if (!clr) {
      throw new Error(`ICE: Binding for '${name}' has no CLR name`);
    }
    const qualified = toGlobalClr(clrTypeNameToCSharp(clr));

    if (typeArguments && typeArguments.length > 0) {
      const typeParams: string[] = [];
      let currentContext = context;
      for (const typeArg of typeArguments) {
        const [paramType, newContext] = emitType(typeArg, currentContext);
        typeParams.push(paramType);
        currentContext = newContext;
      }
      return [`${qualified}<${typeParams.join(", ")}>`, currentContext];
    }

    return [qualified, context];
  }

  // Hard failure: unresolved external reference type
  // This should never happen if the IR soundness gate is working correctly
  throw new Error(
    `ICE: Unresolved reference type '${name}' (no resolvedClrType, no import binding, no registry binding, not local)`
  );
};
