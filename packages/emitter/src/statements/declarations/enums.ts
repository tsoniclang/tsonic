/**
 * Enum declaration emission
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent } from "../../types.js";
import { emitExpression } from "../../expression-emitter.js";

/**
 * Emit an enum declaration
 */
export const emitEnumDeclaration = (
  stmt: Extract<IrStatement, { kind: "enumDeclaration" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);
  const memberInd = getIndent(indent(context));

  const accessibility = stmt.isExported ? "public" : "internal";
  const members = stmt.members
    .map((member) => {
      if (member.initializer) {
        const [initFrag] = emitExpression(member.initializer, context);
        return `${memberInd}${member.name} = ${initFrag.text}`;
      }
      return `${memberInd}${member.name}`;
    })
    .join(",\n");

  const code = `${ind}${accessibility} enum ${stmt.name}\n${ind}{\n${members}\n${ind}}`;
  return [code, context];
};
