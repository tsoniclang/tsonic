/**
 * Interface declaration emission (as C# classes)
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent } from "../../types.js";
import { emitType, emitTypeParameters } from "../../type-emitter.js";
import {
  extractInlineObjectTypes,
  emitExtractedType,
  emitInterfaceMemberAsProperty,
} from "../classes.js";

/**
 * Emit an interface declaration (as C# class)
 */
export const emitInterfaceDeclaration = (
  stmt: Extract<IrStatement, { kind: "interfaceDeclaration" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  // Per spec/16-types-and-interfaces.md §2.1:
  // TypeScript interfaces map to C# classes (not C# interfaces)
  // because TS interfaces are structural and we need nominal types in C#

  const ind = getIndent(context);
  let currentContext = context;

  // Extract inline object types and emit them as separate classes
  const extractedTypes = extractInlineObjectTypes(stmt.members);
  const extractedClassCodes: string[] = [];

  for (const extracted of extractedTypes) {
    const [classCode, newContext] = emitExtractedType(
      extracted,
      currentContext
    );
    extractedClassCodes.push(classCode);
    currentContext = newContext;
  }

  const parts: string[] = [];

  // Access modifier
  const accessibility = stmt.isExported ? "public" : "internal";
  parts.push(accessibility);
  parts.push("class"); // Class, not interface!
  parts.push(stmt.name);

  // Type parameters (if any)
  if (stmt.typeParameters && stmt.typeParameters.length > 0) {
    const [typeParamsStr, whereClauses, typeParamContext] = emitTypeParameters(
      stmt.typeParameters,
      currentContext
    );
    parts.push(typeParamsStr);
    currentContext = typeParamContext;

    // Extended interfaces/classes
    if (stmt.extends && stmt.extends.length > 0) {
      const extended: string[] = [];
      for (const ext of stmt.extends) {
        const [extType, newContext] = emitType(ext, currentContext);
        currentContext = newContext;
        extended.push(extType);
      }
      parts.push(":");
      parts.push(extended.join(", "));
    }

    // Where clauses for type parameters
    if (whereClauses.length > 0) {
      parts.push("\n" + ind + "    " + whereClauses.join("\n" + ind + "    "));
    }
  } else {
    // Extended interfaces/classes (no generics)
    if (stmt.extends && stmt.extends.length > 0) {
      const extended: string[] = [];
      for (const ext of stmt.extends) {
        const [extType, newContext] = emitType(ext, currentContext);
        currentContext = newContext;
        extended.push(extType);
      }
      parts.push(":");
      parts.push(extended.join(", "));
    }
  }

  // Class body with auto-properties
  const bodyContext = indent(currentContext);
  const members: string[] = [];

  for (const member of stmt.members) {
    const [memberCode, newContext] = emitInterfaceMemberAsProperty(
      member,
      bodyContext
    );
    members.push(memberCode);
    currentContext = newContext;
  }

  const signature = parts.join(" ");
  const memberCode = members.join("\n\n");
  const mainClassCode = `${ind}${signature}\n${ind}{\n${memberCode}\n${ind}}`;

  // Combine main interface and extracted classes (extracted classes come after)
  const allParts: string[] = [];
  allParts.push(mainClassCode);
  if (extractedClassCodes.length > 0) {
    allParts.push(...extractedClassCodes);
  }

  const code = allParts.join("\n");

  return [code, currentContext];
};
