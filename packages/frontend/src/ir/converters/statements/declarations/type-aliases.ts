/**
 * Type alias declaration converter
 */

import * as ts from "typescript";
import { IrStatement, IrTypeAliasDeclaration } from "../../../types.js";
import { convertType } from "../../../type-converter.js";
import { hasExportModifier, convertTypeParameters } from "../helpers.js";
import { processTypeAliasForSynthetics } from "../../synthetic-types.js";

/**
 * Convert type alias declaration.
 *
 * If the type alias is a union of object literals, this generates synthetic
 * interface declarations and rewrites the type alias to reference them.
 *
 * @returns Array of statements: [synthetic interfaces..., type alias]
 */
export const convertTypeAliasDeclaration = (
  node: ts.TypeAliasDeclaration,
  checker: ts.TypeChecker
): readonly IrStatement[] => {
  const baseAlias: IrTypeAliasDeclaration = {
    kind: "typeAliasDeclaration",
    name: node.name.text,
    typeParameters: convertTypeParameters(node.typeParameters, checker),
    type: convertType(node.type, checker),
    isExported: hasExportModifier(node),
    isStruct: false, // Type aliases are not structs by default
  };

  // Process for synthetic type generation (union of object literals)
  const result = processTypeAliasForSynthetics(baseAlias);

  // Return synthetics first, then the (possibly rewritten) type alias
  return [...result.syntheticInterfaces, result.typeAlias];
};
