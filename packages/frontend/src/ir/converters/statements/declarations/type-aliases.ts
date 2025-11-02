/**
 * Type alias declaration converter
 */

import * as ts from "typescript";
import { IrTypeAliasDeclaration } from "../../../types.js";
import { convertType } from "../../../type-converter.js";
import { hasExportModifier, convertTypeParameters } from "../helpers.js";

/**
 * Convert type alias declaration
 */
export const convertTypeAliasDeclaration = (
  node: ts.TypeAliasDeclaration,
  checker: ts.TypeChecker
): IrTypeAliasDeclaration => {
  return {
    kind: "typeAliasDeclaration",
    name: node.name.text,
    typeParameters: convertTypeParameters(node.typeParameters, checker),
    type: convertType(node.type, checker),
    isExported: hasExportModifier(node),
  };
};
