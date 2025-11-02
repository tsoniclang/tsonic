/**
 * Type parameter and parameter type emission
 */

import { IrType, IrTypeParameter } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitType } from "./emitter.js";

/**
 * Emit C# type parameters with constraints
 * Example: <T, U extends Foo> → <T, U> with where clauses
 */
export const emitTypeParameters = (
  typeParams: readonly IrTypeParameter[] | undefined,
  context: EmitterContext
): [string, string[], EmitterContext] => {
  if (!typeParams || typeParams.length === 0) {
    return ["", [], context];
  }

  const paramNames = typeParams.map((tp) => tp.name).join(", ");
  const typeParamsStr = `<${paramNames}>`;

  // Build where clauses for constraints
  const whereClauses: string[] = [];
  let currentContext = context;

  for (const tp of typeParams) {
    if (tp.constraint) {
      const [constraintStr, newContext] = emitType(
        tp.constraint,
        currentContext
      );
      currentContext = newContext;

      // Handle structural constraints specially
      if (tp.isStructuralConstraint) {
        // Structural constraints generate interfaces - reference them
        whereClauses.push(`where ${tp.name} : __Constraint_${tp.name}`);
      } else {
        whereClauses.push(`where ${tp.name} : ${constraintStr}`);
      }
    }
  }

  return [typeParamsStr, whereClauses, currentContext];
};

/**
 * Emit a parameter type with optional and default value handling
 */
export const emitParameterType = (
  type: IrType | undefined,
  isOptional: boolean,
  context: EmitterContext
): [string, EmitterContext] => {
  const typeNode = type ?? { kind: "anyType" as const };
  const [baseType, newContext] = emitType(typeNode, context);

  // For optional parameters, add ? suffix for nullable types
  // This includes both value types (double?, int?) and reference types (string?)
  // per spec/04-type-mappings.md:21-78
  if (isOptional) {
    return [`${baseType}?`, newContext];
  }

  return [baseType, newContext];
};
