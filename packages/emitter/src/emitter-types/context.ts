/**
 * Context creation and manipulation functions
 */

import { EmitterOptions, EmitterContext } from "./core.js";

/**
 * Create a new emitter context with default values
 */
export const createContext = (options: EmitterOptions): EmitterContext => ({
  indentLevel: 0,
  options,
  usings: new Set(["Tsonic.Runtime"]),
  isStatic: false,
  isAsync: false,
});

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
 * Add a using statement to the context
 */
export const addUsing = (
  context: EmitterContext,
  namespace: string
): EmitterContext => ({
  ...context,
  usings: new Set([...context.usings, namespace]),
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
