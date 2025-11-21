/**
 * Context creation and manipulation functions
 */

import { EmitterOptions, EmitterContext } from "./core.js";
import {
  loadMetadataDirectory,
  loadBindingsDirectory,
  buildBindingsRegistry,
} from "@tsonic/frontend/metadata/index.js";

/**
 * Create a new emitter context with default values
 */
export const createContext = (options: EmitterOptions): EmitterContext => {
  // Load metadata and bindings if paths provided
  let metadata: EmitterContext["metadata"] = undefined;
  let bindingsRegistry: EmitterContext["bindingsRegistry"] = undefined;

  if (options.metadataPath) {
    const metadataResult = loadMetadataDirectory(options.metadataPath);
    if (metadataResult.ok) {
      metadata = metadataResult.value;
    }
    // TODO: Handle metadata loading errors - need diagnostics infrastructure
  }

  if (options.bindingsPath) {
    const bindingsResult = loadBindingsDirectory(options.bindingsPath);
    if (bindingsResult.ok) {
      bindingsRegistry = buildBindingsRegistry(bindingsResult.value);
    }
    // TODO: Handle bindings loading errors - need diagnostics infrastructure
  }

  return {
    indentLevel: 0,
    options,
    usings: new Set(["Tsonic.Runtime"]),
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
