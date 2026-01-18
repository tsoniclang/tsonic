/**
 * Context creation and manipulation functions
 */

import { EmitterOptions, EmitterContext } from "./core.js";

/**
 * Create a new emitter context with default values
 */
export const createContext = (options: EmitterOptions): EmitterContext => {
  const bindingsRegistry =
    options.clrBindings && options.clrBindings.size > 0
      ? options.clrBindings
      : undefined;

  return {
    indentLevel: 0,
    options,
    isStatic: false,
    isAsync: false,
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
type ScopedFields = Pick<
  EmitterContext,
  | "typeParameters"
  | "typeParamConstraints"
  | "typeParameterNameMap"
  | "returnType"
  | "localNameMap"
>;

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
    typeParamConstraints: context.typeParamConstraints,
    typeParameterNameMap: context.typeParameterNameMap,
    returnType: context.returnType,
    localNameMap: context.localNameMap,
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
