/**
 * Inline object type extraction and emission
 */

import { IrInterfaceMember } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent } from "../../types.js";
import { capitalize } from "./helpers.js";
import { emitInterfaceMemberAsProperty } from "./properties.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";

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
  members: readonly IrInterfaceMember[]
): readonly ExtractedType[] => {
  const extracted: ExtractedType[] = [];

  for (const member of members) {
    if (
      member.kind === "propertySignature" &&
      member.type?.kind === "objectType"
    ) {
      // Generate class name from property name (capitalize)
      const className = capitalize(member.name);
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
  parts.push(`${ind}public class ${escapedClassName}`);
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
