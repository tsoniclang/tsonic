/**
 * Variable declaration converter
 */

import * as ts from "typescript";
import { IrVariableDeclaration } from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import { convertType, convertBindingName } from "../../../type-converter.js";
import { hasExportModifier } from "../helpers.js";

/**
 * Convert variable statement
 */
export const convertVariableStatement = (
  node: ts.VariableStatement,
  checker: ts.TypeChecker
): IrVariableDeclaration => {
  const isConst = !!(node.declarationList.flags & ts.NodeFlags.Const);
  const isLet = !!(node.declarationList.flags & ts.NodeFlags.Let);
  const declarationKind = isConst ? "const" : isLet ? "let" : "var";

  return {
    kind: "variableDeclaration",
    declarationKind,
    declarations: node.declarationList.declarations.map((decl) => ({
      kind: "variableDeclarator",
      name: convertBindingName(decl.name),
      type: decl.type ? convertType(decl.type, checker) : undefined,
      initializer: decl.initializer
        ? convertExpression(decl.initializer, checker)
        : undefined,
    })),
    isExported: hasExportModifier(node),
  };
};
