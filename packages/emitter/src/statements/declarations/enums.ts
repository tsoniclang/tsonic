/**
 * Enum declaration emission — returns CSharpEnumDeclarationAst
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { emitCSharpName } from "../../naming-policy.js";
import type {
  CSharpEnumDeclarationAst,
  CSharpEnumMemberAst,
} from "../../core/format/backend-ast/types.js";

/**
 * Emit an enum declaration as CSharpEnumDeclarationAst
 */
export const emitEnumDeclaration = (
  stmt: Extract<IrStatement, { kind: "enumDeclaration" }>,
  context: EmitterContext
): [CSharpEnumDeclarationAst, EmitterContext] => {
  const promotedToPublic = context.publicLocalTypes?.has(stmt.name) ?? false;
  const accessibility =
    stmt.isExported || promotedToPublic ? "public" : "internal";

  // Enum values require integers, use isArrayIndex to force integer emission
  const enumContext = { ...context, isArrayIndex: true };

  const members: CSharpEnumMemberAst[] = stmt.members.map((member) => {
    const escapedName = emitCSharpName(member.name, "enumMembers", context);
    if (member.initializer) {
      const [initAst] = emitExpressionAst(member.initializer, enumContext);
      return { name: escapedName, value: initAst };
    }
    return { name: escapedName };
  });

  const enumAst: CSharpEnumDeclarationAst = {
    kind: "enumDeclaration",
    attributes: [],
    modifiers: [accessibility],
    name: escapeCSharpIdentifier(stmt.name),
    members,
  };

  return [enumAst, context];
};
