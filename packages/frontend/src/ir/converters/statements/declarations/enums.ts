/**
 * Enum declaration converter
 */

import * as ts from "typescript";
import { IrEnumDeclaration, IrType } from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import { hasExportModifier } from "../helpers.js";
import type { ProgramContext } from "../../../program-context.js";

/**
 * Int type constant for enum initializers
 * Enums in C# use int values, so we pass this as expectedType for deterministic typing.
 */
const INT_TYPE: IrType = { kind: "primitiveType", name: "int" };

/**
 * Convert enum declaration
 */
export const convertEnumDeclaration = (
  node: ts.EnumDeclaration,
  ctx: ProgramContext
): IrEnumDeclaration => {
  return {
    kind: "enumDeclaration",
    name: node.name.text,
    members: node.members.map((m) => ({
      kind: "enumMember" as const,
      name: ts.isIdentifier(m.name) ? m.name.text : "[computed]",
      // Thread int type to enum initializers for deterministic typing
      initializer: m.initializer
        ? convertExpression(m.initializer, ctx, INT_TYPE)
        : undefined,
    })),
    isExported: hasExportModifier(node),
  };
};
