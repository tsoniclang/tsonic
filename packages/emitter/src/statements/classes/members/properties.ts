/**
 * Property member emission
 */

import { IrClassMember } from "@tsonic/frontend";
import { EmitterContext, getIndent } from "../../../types.js";
import { emitExpression } from "../../../expression-emitter.js";
import { emitType } from "../../../type-emitter.js";

/**
 * Emit a property declaration
 */
export const emitPropertyMember = (
  member: IrClassMember & { kind: "propertyDeclaration" },
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  let currentContext = context;
  const parts: string[] = [];

  // Access modifier
  const accessibility = member.accessibility ?? "public";
  parts.push(accessibility);

  if (member.isStatic) {
    parts.push("static");
  }

  // Override modifier (from metadata or TS base class detection)
  if (member.isOverride) {
    parts.push("override");
  }

  if (member.isReadonly) {
    parts.push("readonly");
  }

  // Property type - prefer resolved CLR type, then explicit type, then fallback
  if (member.type) {
    const [typeName, newContext] = emitType(member.type, currentContext);
    currentContext = newContext;
    parts.push(typeName);
  } else if (member.resolvedClrType) {
    // Use pre-resolved CLR type from type checker (for inferred types)
    parts.push(member.resolvedClrType);
  } else {
    parts.push("object");
  }

  // Property name
  parts.push(member.name);

  // Emit as field (TypeScript class fields map to C# fields, not properties)
  let code = `${ind}${parts.join(" ")}`;
  if (member.initializer) {
    const [initFrag, finalContext] = emitExpression(
      member.initializer,
      currentContext
    );
    code += ` = ${initFrag.text}`;
    currentContext = finalContext;
  }
  return [`${code};`, currentContext];
};
