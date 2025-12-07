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
 * These correspond to the types defined in @tsonic/types package.
 */
const CSHARP_PRIMITIVES = new Set([
  // Signed integers (from @tsonic/types)
  "sbyte",
  "short",
  "int",
  "long",
  "nint",
  "int128",
  // Unsigned integers (from @tsonic/types)
  "byte",
  "ushort",
  "uint",
  "ulong",
  "nuint",
  "uint128",
  // Floating-point (from @tsonic/types)
  "half",
  "float",
  "double",
  "decimal",
  // Other primitives (from @tsonic/types)
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
 * Check if a type name indicates an unsupported support type.
 *
 * TODO: This is a basic check. Full implementation requires:
 * 1. Access to TypeScript type checker
 * 2. Integration with support-types.ts helpers
 * 3. Proper diagnostic reporting
 *
 * For now, we check the type name string.
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
    if (typeArguments && typeArguments.length > 0) {
      const typeParams: string[] = [];
      let currentContext = context;
      for (const typeArg of typeArguments) {
        const [paramType, newContext] = emitType(typeArg, currentContext);
        typeParams.push(paramType);
        currentContext = newContext;
      }
      return [`${resolvedClrType}<${typeParams.join(", ")}>`, currentContext];
    }
    return [resolvedClrType, context];
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
    // TODO: Report diagnostic error instead of throwing
    // For now, emit a comment to make the error visible in generated code
    console.warn(`[Tsonic] ${unsupportedError}`);
    return [`/* ERROR: ${unsupportedError} */ object`, context];
  }

  // Handle built-in types
  if (name === "Array" && typeArguments && typeArguments.length > 0) {
    const firstArg = typeArguments[0];
    if (!firstArg) {
      return [`global::System.Collections.Generic.List<object>`, context];
    }
    const [elementType, newContext] = emitType(firstArg, context);
    return [
      `global::System.Collections.Generic.List<${elementType}>`,
      newContext,
    ];
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

  // NOTE: Map and Set are NOT in js-globals or dotnet-globals.
  // They must be explicitly imported or will fail as unresolved types.
  // Per Alice's decision: no ambient Map/Set handling.

  // Get runtime mode for conditional mappings
  const runtime = context.options.runtime ?? "js";

  // Map common JS types to .NET equivalents
  // Only types actually defined in the globals packages
  // Error: only in js-globals (not in dotnet-globals)
  // PromiseLike: in both js-globals and dotnet-globals
  if (name === "Error" && runtime === "js") {
    return ["global::System.Exception", context];
  }

  if (name === "PromiseLike") {
    // PromiseLike is in both globals packages - safe to map unconditionally
    return ["global::System.Threading.Tasks.Task", context];
  }

  // Resolve external types via binding registry (must be fully qualified)
  // This handles types from contextual inference (e.g., Action from Parallel.invoke)
  const regBinding = context.bindingsRegistry?.get(name);
  if (regBinding) {
    const clr = getBindingClrName(regBinding);
    if (!clr) {
      throw new Error(`ICE: Binding for '${name}' has no CLR name`);
    }
    const qualified = toGlobalClr(clr);

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

  // C# primitive types can be emitted directly
  if (CSHARP_PRIMITIVES.has(name)) {
    return [name, context];
  }

  // Type parameters in scope can be emitted directly
  if (context.typeParameters?.has(name)) {
    return [name, context];
  }

  // FALLTHROUGH is only permitted for local types.
  // Emitting a bare external name is unsound and forbidden.
  if (context.localTypes?.has(name)) {
    // Convert nested type names (Outer$Inner → Outer.Inner)
    const csharpName = isNestedType(name) ? tsCSharpNestedTypeName(name) : name;

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

  // Hard failure: unresolved external reference type
  // This should never happen if the IR soundness gate is working correctly
  throw new Error(
    `ICE: Unresolved reference type '${name}' (no resolvedClrType, no import binding, no registry binding, not local)`
  );
};
