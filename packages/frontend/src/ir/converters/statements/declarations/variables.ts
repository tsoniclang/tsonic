/**
 * Variable declaration converter
 */

import * as ts from "typescript";
import { IrVariableDeclaration } from "../../../types.js";
import { convertExpression } from "../../../expression-converter.js";
import {
  convertType,
  convertBindingName,
  inferType,
} from "../../../type-converter.js";
import { hasExportModifier } from "../helpers.js";

/**
 * Get the IR type for a variable declaration.
 * Uses explicit annotation if present, otherwise infers from TypeChecker.
 */
const getDeclarationType = (
  decl: ts.VariableDeclaration,
  checker: ts.TypeChecker,
  needsExplicitType: boolean
) => {
  // If there's an explicit type annotation, use it
  if (decl.type) {
    return convertType(decl.type, checker);
  }
  // If we need an explicit type (for module-level exports), infer it
  if (needsExplicitType) {
    return inferType(decl, checker);
  }
  return undefined;
};

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
  const isExported = hasExportModifier(node);

  return {
    kind: "variableDeclaration",
    declarationKind,
    declarations: node.declarationList.declarations.map((decl) => ({
      kind: "variableDeclarator",
      name: convertBindingName(decl.name),
      type: getDeclarationType(decl, checker, isExported),
      initializer: decl.initializer
        ? convertExpression(decl.initializer, checker)
        : undefined,
    })),
    isExported,
  };
};
