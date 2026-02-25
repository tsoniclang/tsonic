/**
 * Enum declaration emission
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { printExpression } from "../../core/format/backend-ast/printer.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { emitCSharpName } from "../../naming-policy.js";

/**
 * Emit an enum declaration
 */
export const emitEnumDeclaration = (
  stmt: Extract<IrStatement, { kind: "enumDeclaration" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const memberInd = getIndent(indent(context));

  const promotedToPublic = context.publicLocalTypes?.has(stmt.name) ?? false;
  const accessibility =
    stmt.isExported || promotedToPublic ? "public" : "internal";
  // Enum values require integers, use isArrayIndex to force integer emission
  const enumContext = { ...context, isArrayIndex: true };
  const members = stmt.members
    .map((member) => {
      const escapedName = emitCSharpName(member.name, "enumMembers", context);
      if (member.initializer) {
        const [initAst] = emitExpressionAst(member.initializer, enumContext);
        return `${memberInd}${escapedName} = ${printExpression(initAst)}`;
      }
      return `${memberInd}${escapedName}`;
    })
    .join(",\n");

  const code = `${ind}${accessibility} enum ${escapeCSharpIdentifier(stmt.name)}\n${ind}{\n${members}\n${ind}}`;
  return [code, context];
};
