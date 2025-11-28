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

  // Map common JS types to .NET equivalents
  // Note: Date, RegExp, Map, Set are NOT SUPPORTED in MVP
  // Users should use System.DateTime, System.Text.RegularExpressions.Regex,
  // Dictionary<K,V>, and HashSet<T> directly
  const runtimeTypes: Record<string, string> = {
    Error: "System.Exception",
  };

  if (name in runtimeTypes) {
    const csharpType = runtimeTypes[name];
    if (!csharpType) {
      return [name, context];
    }

    // Always emit with global:: prefix for unambiguous resolution
    const fqnType = `global::${csharpType}`;

    if (typeArguments && typeArguments.length > 0) {
      const typeParams: string[] = [];
      let currentContext = context;

      for (const typeArg of typeArguments) {
        const [paramType, newContext] = emitType(typeArg, currentContext);
        typeParams.push(paramType);
        currentContext = newContext;
      }

      return [`${fqnType}<${typeParams.join(", ")}>`, currentContext];
    }

    return [fqnType, context];
  }

  // Handle type arguments for other reference types
  if (typeArguments && typeArguments.length > 0) {
    const typeParams: string[] = [];
    let currentContext = context;

    for (const typeArg of typeArguments) {
      const [paramType, newContext] = emitType(typeArg, currentContext);
      typeParams.push(paramType);
      currentContext = newContext;
    }

    // Convert nested type names (Outer$Inner → Outer.Inner)
    const csharpName = isNestedType(name) ? tsCSharpNestedTypeName(name) : name;

    return [`${csharpName}<${typeParams.join(", ")}>`, currentContext];
  }

  // Convert nested type names (Outer$Inner → Outer.Inner)
  // before returning the name
  const csharpName = isNestedType(name) ? tsCSharpNestedTypeName(name) : name;

  return [csharpName, context];
};
