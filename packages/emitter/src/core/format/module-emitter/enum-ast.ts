import { IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import { emitExpression } from "../../../expression-emitter.js";
import { emitCSharpName } from "../../../naming-policy.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import type { CSharpEnumDeclarationAst } from "../backend-ast/types.js";

export const emitEnumDeclarationAst = (
  stmt: Extract<IrStatement, { kind: "enumDeclaration" }>,
  context: EmitterContext,
  indentLevel: number
): [CSharpEnumDeclarationAst, EmitterContext] => {
  const promotedToPublic = context.publicLocalTypes?.has(stmt.name) ?? false;
  const accessibility =
    stmt.isExported || promotedToPublic ? "public" : "internal";
  const enumContext: EmitterContext = { ...context, isArrayIndex: true };
  let currentContext = enumContext;

  const members: Array<CSharpEnumDeclarationAst["members"][number]> = [];
  for (const member of stmt.members) {
    let initializer;
    if (member.initializer) {
      const [initFrag, nextContext] = emitExpression(
        member.initializer,
        currentContext
      );
      currentContext = nextContext;
      initializer = { kind: "rawExpression", text: initFrag.text } as const;
    }

    members.push({
      kind: "enumMember",
      name: emitCSharpName(member.name, "enumMembers", context),
      initializer,
    });
  }

  return [
    {
      kind: "enumDeclaration",
      indentLevel,
      attributes: [],
      modifiers: [accessibility],
      name: escapeCSharpIdentifier(stmt.name),
      members,
    },
    currentContext,
  ];
};
