/**
 * Inline object type extraction and emission
 */

import { IrInterfaceMember } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent } from "../../types.js";
import { emitInterfaceMemberAsProperty } from "./properties.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { typeUsesPointer } from "../../core/unsafe.js";
import { getCSharpName } from "../../naming-policy.js";

/**
 * Extracted inline object type
 */
export type ExtractedType = {
  readonly className: string;
  readonly members: readonly IrInterfaceMember[];
};

/**
 * Extract inline object types from interface members and generate class declarations
 */
export const extractInlineObjectTypes = (
  members: readonly IrInterfaceMember[],
  context: EmitterContext
): readonly ExtractedType[] => {
  const extracted: ExtractedType[] = [];

  for (const member of members) {
    if (
      member.kind === "propertySignature" &&
      member.type?.kind === "objectType"
    ) {
      // Generated type name uses naming policy for classes
      const className = getCSharpName(member.name, "classes", context);
      extracted.push({
        className,
        members: member.type.members,
      });
    }
  }

  return extracted;
};

/**
 * Emit an extracted inline object type as a class
 */
export const emitExtractedType = (
  extracted: ExtractedType,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  let currentContext = context;

  const parts: string[] = [];
  const escapedClassName = escapeCSharpIdentifier(extracted.className);
  const needsUnsafe = extracted.members.some((m) => {
    if (m.kind === "propertySignature") return typeUsesPointer(m.type);
    if (m.kind === "methodSignature") {
      return (
        m.parameters.some((p) => typeUsesPointer(p.type)) ||
        typeUsesPointer(m.returnType)
      );
    }
    return false;
  });
  parts.push(`${ind}public${needsUnsafe ? " unsafe" : ""} class ${escapedClassName}`);
  parts.push(`${ind}{`);

  // Emit properties
  const bodyContext = indent(currentContext);
  const propertyParts: string[] = [];
  let bodyCurrentContext = bodyContext;

  for (const member of extracted.members) {
    const [memberCode, newContext] = emitInterfaceMemberAsProperty(
      member,
      bodyCurrentContext
    );
    propertyParts.push(memberCode);
    bodyCurrentContext = newContext;
  }

  if (propertyParts.length > 0) {
    parts.push(propertyParts.join("\n"));
  }

  parts.push(`${ind}}`);

  // Return context at original indent level
  return [parts.join("\n"), context];
};
