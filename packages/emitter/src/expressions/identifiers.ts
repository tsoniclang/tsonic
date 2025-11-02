/**
 * Identifier and type argument emitters
 */

import { IrExpression, IrType } from "@tsonic/frontend";
import { EmitterContext, CSharpFragment, addUsing } from "../types.js";
import { emitType } from "../type-emitter.js";

/**
 * Emit an identifier, mapping JavaScript globals to Tsonic.Runtime equivalents
 */
export const emitIdentifier = (
  expr: Extract<IrExpression, { kind: "identifier" }>,
  context: EmitterContext
): [CSharpFragment, EmitterContext] => {
  // Map JavaScript global identifiers to Tsonic.Runtime equivalents
  const identifierMap: Record<string, string> = {
    console: "Tsonic.Runtime.console",
    Math: "Tsonic.Runtime.Math",
    JSON: "Tsonic.Runtime.JSON",
    parseInt: "Tsonic.Runtime.parseInt",
    parseFloat: "Tsonic.Runtime.parseFloat",
    isNaN: "Tsonic.Runtime.isNaN",
    isFinite: "Tsonic.Runtime.isFinite",
    undefined: "default",
  };

  const mapped = identifierMap[expr.name];
  if (mapped) {
    const updatedContext = addUsing(context, "Tsonic.Runtime");
    return [{ text: mapped }, updatedContext];
  }

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
