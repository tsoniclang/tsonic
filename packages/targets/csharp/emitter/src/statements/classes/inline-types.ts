/**
 * Inline object type extraction and emission — returns CSharpTypeDeclarationAst
 */

import { IrInterfaceMember } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitInterfaceMemberAsProperty } from "./properties.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { typeUsesPointer } from "../../core/semantic/unsafe.js";
import { getCSharpName } from "../../naming-policy.js";
import type {
  CSharpTypeDeclarationAst,
  CSharpMemberAst,
} from "../../core/format/backend-ast/types.js";

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
 * Emit an extracted inline object type as CSharpClassDeclarationAst
 */
export const emitExtractedType = (
  extracted: ExtractedType,
  context: EmitterContext
): [CSharpTypeDeclarationAst, EmitterContext] => {
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

  const modifiers: string[] = ["public"];
  if (needsUnsafe) modifiers.push("unsafe");

  // Emit member properties
  const members: CSharpMemberAst[] = [];
  let currentContext = context;

  for (const member of extracted.members) {
    const [memberAst, newContext] = emitInterfaceMemberAsProperty(
      member,
      currentContext
    );
    members.push(memberAst);
    currentContext = newContext;
  }

  const declAst: CSharpTypeDeclarationAst = {
    kind: "classDeclaration",
    attributes: [],
    modifiers,
    name: escapedClassName,
    interfaces: [],
    members,
  };

  // Return context at original indent level
  return [declAst, context];
};
