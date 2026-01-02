/**
 * Type alias declaration converter
 */

import * as ts from "typescript";
import { IrStatement, IrTypeAliasDeclaration } from "../../../types.js";
import { hasExportModifier, convertTypeParameters } from "../helpers.js";
import { processTypeAliasForSynthetics } from "../../synthetic-types.js";
import { getTypeSystem } from "./registry.js";
import type { Binding } from "../../../binding/index.js";

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
  binding: Binding
): readonly IrStatement[] => {
  // ALICE'S SPEC: Use TypeSystem.convertTypeNode() for all type conversion
  const typeSystem = getTypeSystem();
  const baseAlias: IrTypeAliasDeclaration = {
    kind: "typeAliasDeclaration",
    name: node.name.text,
    typeParameters: convertTypeParameters(node.typeParameters, binding),
    type: typeSystem
      ? typeSystem.convertTypeNode(node.type)
      : { kind: "unknownType" },
    isExported: hasExportModifier(node),
    isStruct: false, // Type aliases are not structs by default
  };

  // Process for synthetic type generation (union of object literals)
  const result = processTypeAliasForSynthetics(baseAlias);

  // Return synthetics first, then the (possibly rewritten) type alias
  return [...result.syntheticInterfaces, result.typeAlias];
};
