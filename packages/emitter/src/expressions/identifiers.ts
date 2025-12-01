/**
 * Identifier and type argument emitters
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "../types.js";
import { emitType } from "../type-emitter.js";

/**
 * Fallback mappings for well-known runtime globals
 * Used when binding manifests are not available (e.g., in tests)
 * All use global:: prefix for unambiguous resolution.
 */
const RUNTIME_FALLBACKS: Record<string, string> = {
  console: "global::Tsonic.JSRuntime.console",
  Math: "global::Tsonic.JSRuntime.Math",
  JSON: "global::Tsonic.JSRuntime.JSON",
  parseInt: "global::Tsonic.JSRuntime.Globals.parseInt",
  parseFloat: "global::Tsonic.JSRuntime.Globals.parseFloat",
  isNaN: "global::Tsonic.JSRuntime.Globals.isNaN",
  isFinite: "global::Tsonic.JSRuntime.Globals.isFinite",
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

  // Check if this identifier is from an import
  if (context.importBindings) {
    const binding = context.importBindings.get(expr.name);
    if (binding) {
      // Imported identifier - always use fully-qualified reference
      // Use pre-computed clrName directly (all resolution done when building binding)
      if (binding.member) {
        // Value import with member - Container.member
        return [{ text: `${binding.clrName}.${binding.member}` }, context];
      }
      // Type, namespace, or default import - use clrName directly
      return [{ text: binding.clrName }, context];
    }
  }

  // Use custom C# name from binding if specified (with global:: prefix)
  if (expr.csharpName && expr.resolvedAssembly) {
    const fqn = `global::${expr.resolvedAssembly}.${expr.csharpName}`;
    return [{ text: fqn }, context];
  }

  // Use resolved binding if available (from binding manifest) with global:: prefix
  // resolvedClrType is already the full CLR type name, just add global::
  if (expr.resolvedClrType) {
    const fqn = `global::${expr.resolvedClrType}`;
    return [{ text: fqn }, context];
  }

  // Fallback for well-known runtime globals (only in js mode)
  // In dotnet mode, there is no JS emulation - these globals don't exist
  const runtime = context.options.runtime ?? "js";
  if (runtime === "js") {
    const fallback = RUNTIME_FALLBACKS[expr.name];
    if (fallback) {
      // RUNTIME_FALLBACKS already have global:: prefix
      return [{ text: fallback }, context];
    }
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
