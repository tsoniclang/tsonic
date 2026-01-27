/**
 * Identifier and type argument emitters
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment } from "../types.js";
import { emitType } from "../type-emitter.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";

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

  // Narrowing remap for union type guards
  // - "rename": account -> account__1_3 (if-statements with temp var)
  // - "expr": account -> (account.As1()) (ternary expressions, inline)
  if (context.narrowedBindings) {
    const narrowed = context.narrowedBindings.get(expr.name);
    if (narrowed) {
      if (narrowed.kind === "rename") {
        return [{ text: escapeCSharpIdentifier(narrowed.name) }, context];
      } else {
        // kind === "expr" - emit expression text verbatim (no escaping)
        return [{ text: narrowed.exprText }, context];
      }
    }
  }

  // Lexical remap for locals/parameters (prevents C# CS0136 shadowing errors).
  const remappedLocal = context.localNameMap?.get(expr.name);
  if (remappedLocal) {
    return [{ text: remappedLocal }, context];
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

  // Static module members (functions/fields) in the current file's container class.
  // These are emitted with namingPolicy (e.g., `main` → `Main` under `clr`).
  const valueSymbol = context.valueSymbols?.get(expr.name);
  if (valueSymbol) {
    const memberName = escapeCSharpIdentifier(valueSymbol.csharpName);
    if (
      context.moduleStaticClassName &&
      context.className !== context.moduleStaticClassName
    ) {
      return [
        { text: `${context.moduleStaticClassName}.${memberName}` },
        context,
      ];
    }
    return [{ text: memberName }, context];
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

  // Fallback: use identifier as-is (escape C# keywords)
  return [{ text: escapeCSharpIdentifier(expr.name) }, context];
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
