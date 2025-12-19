/**
 * Property member emission
 */

import { IrClassMember } from "@tsonic/frontend";
import { EmitterContext, getIndent } from "../../../types.js";
import { emitExpression } from "../../../expression-emitter.js";
import { emitType } from "../../../type-emitter.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { emitAttributes } from "../../../core/attributes.js";

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

  // Required modifier (C# 11) - must be set in object initializer
  if (member.isRequired) {
    parts.push("required");
  }

  if (member.isReadonly) {
    parts.push("readonly");
  }

  // Property type - uses standard type emission pipeline
  // Note: type is always set for class fields (from annotation or inference)
  if (member.type) {
    const [typeName, newContext] = emitType(member.type, currentContext);
    currentContext = newContext;
    parts.push(typeName);
  } else {
    parts.push("object");
  }

  // Property name (escape C# keywords)
  parts.push(escapeCSharpIdentifier(member.name));

  // Emit attributes before the property declaration
  const [attributesCode, attrContext] = emitAttributes(
    member.attributes,
    currentContext
  );
  currentContext = attrContext;

  // Emit as field (TypeScript class fields map to C# fields, not properties)
  const attrPrefix = attributesCode ? attributesCode + "\n" : "";
  let code = `${attrPrefix}${ind}${parts.join(" ")}`;
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
