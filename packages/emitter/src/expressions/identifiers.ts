/**
 * Identifier and type argument emitters
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment, addUsing } from "../types.js";
import { emitType } from "../type-emitter.js";

/**
 * Fallback mappings for well-known runtime globals
 * Used when binding manifests are not available (e.g., in tests)
 */
const RUNTIME_FALLBACKS: Record<string, string> = {
  console: "Tsonic.Runtime.console",
  Math: "Tsonic.Runtime.Math",
  JSON: "Tsonic.Runtime.JSON",
  parseInt: "Tsonic.Runtime.Globals.parseInt",
  parseFloat: "Tsonic.Runtime.Globals.parseFloat",
  isNaN: "Tsonic.Runtime.Globals.isNaN",
  isFinite: "Tsonic.Runtime.Globals.isFinite",
};

/**
 * Emit an identifier, using resolved binding info if available
 */
export const emitIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Special case for undefined -> default
  if (expr.name === "undefined") {
    return [{ text: "default" }, context];
  }

  // Use custom C# name from binding if specified
  if (expr.csharpName && expr.resolvedAssembly) {
    const updatedContext = addUsing(context, expr.resolvedAssembly);
    return [{ text: expr.csharpName }, updatedContext];
  }

  // Use resolved binding if available (from binding manifest)
  if (expr.resolvedClrType && expr.resolvedAssembly) {
    const updatedContext = addUsing(context, expr.resolvedAssembly);
    return [{ text: expr.resolvedClrType }, updatedContext];
  }

  // Fallback for well-known runtime globals (when bindings not available)
  const fallback = RUNTIME_FALLBACKS[expr.name];
  if (fallback) {
    const updatedContext = addUsing(context, "Tsonic.Runtime");
    return [{ text: fallback }, updatedContext];
  }

  // Fallback: use identifier as-is
  return [{ text: expr.name }, context];
};

/**
 * Emit type arguments as C# generic type parameters
 * Example: [string, number] → <string, double>
 */
export const emitTypeArguments = (
  typeArgs: readonly IrType[],
  context: EmitterContext
): [string, EmitterContext] => {
  if (!typeArgs || typeArgs.length === 0) {
    return ["", context];
  }

  let currentContext = context;
  const typeStrings: string[] = [];

  for (const typeArg of typeArgs) {
    const [typeStr, newContext] = emitType(typeArg, currentContext);
    currentContext = newContext;
    typeStrings.push(typeStr);
  }

  return [`<${typeStrings.join(", ")}>`, currentContext];
};

/**
 * Generate specialized method/class name from type arguments
 * Example: process with [string, number] → process__string__double
 */
export const generateSpecializedName = (
  baseName: string,
  typeArgs: readonly IrType[],
  context: EmitterContext
): [string, EmitterContext] => {
  let currentContext = context;
  const typeNames: string[] = [];

  for (const typeArg of typeArgs) {
    const [typeName, newContext] = emitType(typeArg, currentContext);
    currentContext = newContext;
    // Sanitize type name for use in identifier (remove <>, ?, etc.)
    const sanitized = typeName.replace(/[<>?,\s]/g, "_").replace(/\./g, "_");
    typeNames.push(sanitized);
  }

  const specializedName = `${baseName}__${typeNames.join("__")}`;
  return [specializedName, currentContext];
};
