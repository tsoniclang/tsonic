/**
 * Enum declaration converter
 */

import * as ts from "typescript";
import { IrEnumDeclaration } from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import { hasExportModifier } from "../helpers.js";

/**
 * Convert enum declaration
 */
export const convertEnumDeclaration = (
  node: ts.EnumDeclaration,
  checker: ts.TypeChecker
): IrEnumDeclaration => {
  return {
    kind: "enumDeclaration",
    name: node.name.text,
    members: node.members.map((m) => ({
      kind: "enumMember" as const,
      name: ts.isIdentifier(m.name) ? m.name.text : "[computed]",
      initializer: m.initializer
        ? convertExpression(m.initializer, checker)
        : undefined,
    })),
    isExported: hasExportModifier(node),
  };
};
