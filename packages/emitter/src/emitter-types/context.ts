/**
 * Context creation and manipulation functions
 */

import { EmitterOptions, EmitterContext } from "./core.js";
import {
  loadLibraries,
  buildBindingsRegistry,
} from "@tsonic/frontend/metadata/index.js";
import type { TypeBinding } from "@tsonic/frontend/types/bindings.js";

/**
 * Create a new emitter context with default values
 */
export const createContext = (options: EmitterOptions): EmitterContext => {
  // Load metadata and bindings from library directories
  let metadata: EmitterContext["metadata"] = undefined;
  let bindingsRegistry: EmitterContext["bindingsRegistry"] = undefined;

  // Prefer pre-loaded bindings from frontend (clrBindings) over library loading
  if (options.clrBindings && options.clrBindings.size > 0) {
    // Convert frontend bindings to emitter format
    // Frontend TypeBinding has: { name: CLR_NAME, alias: TS_NAME, ... }
    // Emitter expects: { clrName: CLR_NAME, ... } or { name: CLR_NAME, ... }
    // getBindingClrName in references.ts handles both formats via duck typing
    const converted = new Map<string, TypeBinding>();
    for (const [tsName, binding] of options.clrBindings) {
      // Create a binding compatible with getBindingClrName
      // It checks for clrName first, then name - we provide both for safety
      converted.set(tsName, {
        clrName: binding.name, // Frontend's name field IS the CLR name
        tsEmitName: binding.alias,
        assemblyName: "", // Not needed for type resolution
        metadataToken: 0, // Not needed for type resolution
      });
    }
    bindingsRegistry = converted;
  } else if (options.libraries && options.libraries.length > 0) {
    // Fallback: load from library directories (legacy path)
    const librariesResult = loadLibraries(options.libraries);
    if (librariesResult.ok) {
      metadata = librariesResult.value.metadata;
      bindingsRegistry = buildBindingsRegistry(librariesResult.value.bindings);
    } else {
      // TODO: Report diagnostics from librariesResult.error
      // Need to integrate diagnostic reporting infrastructure
      console.warn(
        "[Tsonic] Failed to load libraries:",
        librariesResult.error.map((d) => d.message).join(", ")
      );
    }
  }

  return {
    indentLevel: 0,
    options,
    isStatic: false,
    isAsync: false,
    metadata,
    bindingsRegistry,
  };
};

/**
 * Increase indentation level
 */
export const indent = (context: EmitterContext): EmitterContext => ({
  ...context,
  indentLevel: context.indentLevel + 1,
});

/**
 * Decrease indentation level
 */
export const dedent = (context: EmitterContext): EmitterContext => ({
  ...context,
  indentLevel: Math.max(0, context.indentLevel - 1),
});

/**
 * Set static context flag
 */
export const withStatic = (
  context: EmitterContext,
  isStatic: boolean
): EmitterContext => ({
  ...context,
  isStatic,
});

/**
 * Set async context flag
 */
export const withAsync = (
  context: EmitterContext,
  isAsync: boolean
): EmitterContext => ({
  ...context,
  isAsync,
});

/**
 * Set current class name in context
 */
export const withClassName = (
  context: EmitterContext,
  className: string
): EmitterContext => ({
  ...context,
  className,
});

/**
 * Scoped fields that should be restored after emission.
 * These fields define lexical scopes and should not leak to parent scopes.
 */
type ScopedFields = Pick<EmitterContext, "typeParameters" | "returnType">;

/**
 * Execute an emission function with scoped context fields.
 *
 * This helper ensures that scoped fields (typeParameters, returnType) are
 * restored after emission, preventing scope leaks when context is threaded
 * upward via [result, newContext] tuples.
 *
 * Other context mutations (intLoopVars, importBindings, etc.) are preserved
 * and bubbled up correctly.
 *
 * @example
 * ```typescript
 * const [result, finalCtx] = withScoped(
 *   context,
 *   {
 *     typeParameters: new Set([...context.typeParameters ?? [], "T"]),
 *     returnType: stmt.returnType
 *   },
 *   (scopedCtx) => emitFunctionBody(stmt.body, scopedCtx)
 * );
 * ```
 */
export const withScoped = <T>(
  context: EmitterContext,
  scopedPatch: Partial<ScopedFields>,
  emit: (ctx: EmitterContext) => [T, EmitterContext]
): [T, EmitterContext] => {
  // Save current scoped field values
  const saved: ScopedFields = {
    typeParameters: context.typeParameters,
    returnType: context.returnType,
  };

  // Create child context with scoped patch applied
  const childContext: EmitterContext = { ...context, ...scopedPatch };

  // Execute the emission
  const [result, innerContext] = emit(childContext);

  // Restore scoped fields while keeping other mutations from child
  const restoredContext: EmitterContext = {
    ...innerContext,
    ...saved,
  };

  return [result, restoredContext];
};
