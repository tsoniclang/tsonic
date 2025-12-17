/**
 * Attribute emission helpers
 *
 * Emits C# attribute syntax from IrAttribute nodes.
 *
 * Example:
 * ```typescript
 * A.on(User).type(SerializableAttribute);
 * A.on(User).type(DataContractAttribute, { Name: "UserDTO" });
 * ```
 *
 * Emits:
 * ```csharp
 * [global::System.SerializableAttribute]
 * [global::System.Runtime.Serialization.DataContractAttribute(Name = "UserDTO")]
 * public class User { ... }
 * ```
 */

import { IrAttribute, IrAttributeArg, IrType } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitType } from "../type-emitter.js";
import { getIndent } from "../emitter-types/index.js";

/**
 * Emit a single attribute argument value.
 */
const emitAttributeArg = (
  arg: IrAttributeArg,
  context: EmitterContext
): [string, EmitterContext] => {
  switch (arg.kind) {
    case "string":
      // Escape string for C# literal
      return [
        `"${arg.value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
        context,
      ];
    case "number":
      return [String(arg.value), context];
    case "boolean":
      return [arg.value ? "true" : "false", context];
    case "typeof": {
      const [typeStr, newContext] = emitType(arg.type, context);
      return [`typeof(${typeStr})`, newContext];
    }
    case "enum": {
      const [typeStr, newContext] = emitType(arg.type, context);
      return [`${typeStr}.${arg.member}`, newContext];
    }
  }
};

/**
 * Get the fully qualified name for an attribute type.
 * Resolves IrType to its C# name.
 */
const getAttributeTypeName = (
  type: IrType,
  context: EmitterContext
): [string, EmitterContext] => {
  // Use emitType to get the proper C# type name with global:: prefix
  return emitType(type, context);
};

/**
 * Emit a single attribute.
 *
 * @param attr - The IR attribute to emit
 * @param context - Emitter context
 * @returns Tuple of [attribute text (without brackets), context]
 */
const emitAttribute = (
  attr: IrAttribute,
  context: EmitterContext
): [string, EmitterContext] => {
  const [typeName, typeContext] = getAttributeTypeName(
    attr.attributeType,
    context
  );

  const parts: string[] = [];
  let currentContext = typeContext;

  // Emit positional arguments
  for (const arg of attr.positionalArgs) {
    const [argStr, newContext] = emitAttributeArg(arg, currentContext);
    parts.push(argStr);
    currentContext = newContext;
  }

  // Emit named arguments
  for (const [name, arg] of attr.namedArgs) {
    const [argStr, newContext] = emitAttributeArg(arg, currentContext);
    parts.push(`${name} = ${argStr}`);
    currentContext = newContext;
  }

  // Build attribute text
  const argsStr = parts.length > 0 ? `(${parts.join(", ")})` : "";
  return [`${typeName}${argsStr}`, currentContext];
};

/**
 * Emit all attributes for a declaration.
 *
 * @param attributes - Array of attributes (may be undefined)
 * @param context - Emitter context
 * @returns Tuple of [attribute lines string, context]
 *
 * Returns empty string if no attributes.
 * Each attribute is on its own line with the current indentation.
 */
export const emitAttributes = (
  attributes: readonly IrAttribute[] | undefined,
  context: EmitterContext
): [string, EmitterContext] => {
  if (!attributes || attributes.length === 0) {
    return ["", context];
  }

  const ind = getIndent(context);
  const lines: string[] = [];
  let currentContext = context;

  for (const attr of attributes) {
    const [attrStr, newContext] = emitAttribute(attr, currentContext);
    currentContext = newContext;
    lines.push(`${ind}[${attrStr}]`);
  }

  return [lines.join("\n"), currentContext];
};

/**
 * Emit parameter-level attributes inline.
 *
 * @param attributes - Array of attributes (may be undefined)
 * @param context - Emitter context
 * @returns Tuple of [attribute prefix string, context]
 *
 * Returns empty string if no attributes.
 * Format: `[Attr1][Attr2] ` (with trailing space if any attributes)
 */
export const emitParameterAttributes = (
  attributes: readonly IrAttribute[] | undefined,
  context: EmitterContext
): [string, EmitterContext] => {
  if (!attributes || attributes.length === 0) {
    return ["", context];
  }

  const parts: string[] = [];
  let currentContext = context;

  for (const attr of attributes) {
    const [attrStr, newContext] = emitAttribute(attr, currentContext);
    currentContext = newContext;
    parts.push(`[${attrStr}]`);
  }

  return [parts.join("") + " ", currentContext];
};
