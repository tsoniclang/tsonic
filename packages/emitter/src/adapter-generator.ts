/**
 * Adapter Generator - Generate C# adapters for structural constraints
 * Per spec/15-generics.md §4 - Structural Constraints & Adapters
 */

import { IrTypeParameter } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent } from "./types.js";
import { emitType } from "./type-emitter.js";

/**
 * Generate adapter interface and wrapper class for a structural constraint
 *
 * Example:
 * Input: T extends { id: number; name: string }
 * Output:
 *   interface __Constraint_T {
 *     double id { get; }
 *     string name { get; }
 *   }
 *
 *   sealed class __Wrapper_T : __Constraint_T {
 *     public double id { get; set; }
 *     public string name { get; set; }
 *   }
 */
export const generateStructuralAdapter = (
  typeParam: IrTypeParameter,
  context: EmitterContext
): [string, EmitterContext] => {
  if (!typeParam.isStructuralConstraint || !typeParam.structuralMembers) {
    return ["", context];
  }

  const ind = getIndent(context);
  const bodyInd = getIndent(indent(context));
  const parts: string[] = [];
  let currentContext = context;

  const interfaceName = `__Constraint_${typeParam.name}`;
  const wrapperName = `__Wrapper_${typeParam.name}`;

  // Generate interface
  parts.push(`${ind}public interface ${interfaceName}`);
  parts.push(`${ind}{`);

  for (const member of typeParam.structuralMembers) {
    if (member.kind === "propertySignature") {
      const [memberType, newContext] = emitType(member.type, currentContext);
      currentContext = newContext;

      const optional = member.isOptional ? "?" : "";
      parts.push(`${bodyInd}${memberType}${optional} ${member.name} { get; }`);
    }
  }

  parts.push(`${ind}}`);
  parts.push(""); // Blank line

  // Generate wrapper class
  parts.push(`${ind}public sealed class ${wrapperName} : ${interfaceName}`);
  parts.push(`${ind}{`);

  for (const member of typeParam.structuralMembers) {
    if (member.kind === "propertySignature") {
      const [memberType, newContext] = emitType(member.type, currentContext);
      currentContext = newContext;

      const optional = member.isOptional ? "?" : "";
      parts.push(
        `${bodyInd}public ${memberType}${optional} ${member.name} { get; set; }`
      );
    }
  }

  parts.push(`${ind}}`);

  return [parts.join("\n"), currentContext];
};

/**
 * Generate all structural adapters for a set of type parameters
 */
export const generateStructuralAdapters = (
  typeParams: readonly IrTypeParameter[] | undefined,
  context: EmitterContext
): [string, EmitterContext] => {
  if (!typeParams || typeParams.length === 0) {
    return ["", context];
  }

  const adapters: string[] = [];
  let currentContext = context;

  for (const tp of typeParams) {
    if (tp.isStructuralConstraint && tp.structuralMembers) {
      const [adapterCode, newContext] = generateStructuralAdapter(
        tp,
        currentContext
      );
      if (adapterCode) {
        adapters.push(adapterCode);
        currentContext = newContext;
      }
    }
  }

  if (adapters.length === 0) {
    return ["", context];
  }

  return [adapters.join("\n\n"), currentContext];
};
