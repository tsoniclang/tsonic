/**
 * Context creation and manipulation functions
 */

import { EmitterOptions, EmitterContext } from "./core.js";
import {
  loadLibraries,
  buildBindingsRegistry,
} from "@tsonic/frontend/metadata/index.js";

/**
 * Create a new emitter context with default values
 */
export const createContext = (options: EmitterOptions): EmitterContext => {
  // Load metadata and bindings from library directories
  let metadata: EmitterContext["metadata"] = undefined;
  let bindingsRegistry: EmitterContext["bindingsRegistry"] = undefined;

  if (options.libraries && options.libraries.length > 0) {
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

  // Tsonic.Runtime ALWAYS needed (for unions, typeof, structural)
  // Tsonic.JSRuntime only for runtime: "js"
  const initialUsings = new Set<string>([
    "System.Collections.Generic",
    "Tsonic.Runtime",
  ]);
  if (options.runtime !== "dotnet") {
    initialUsings.add("Tsonic.JSRuntime");
  }

  return {
    indentLevel: 0,
    options,
    usings: initialUsings,
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
