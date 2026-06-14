/**
 * Type alias declaration converter
 */

import {
  getTstsContainingSourceFileName,
  getTstsDeclaredTypeNode,
  getTstsNodeNameText,
  getTstsTypeParameterNodes,
  type TstsNode,
} from "@tsonic/tsts";
import {
  IrType,
  IrStatement,
  IrTypeAliasDeclaration,
  stampRuntimeUnionAliasCarrier,
} from "../../../types.js";
import {
  definedTstsNodes,
  hasExportModifier,
  convertTypeParameters,
} from "../helpers.js";
import { processTypeAliasForSynthetics } from "../../synthetic-types.js";
import type { ProgramContext } from "../../../program-context.js";
import { resolveSourceFileIdentity } from "../../../../program/source-file-identity.js";

const stampAliasCarrier = (
  type: IrType,
  node: TstsNode,
  ctx: ProgramContext
): IrType => {
  const sourceIdentity = resolveSourceFileIdentity(
    getTstsContainingSourceFileName(node) ?? "",
    ctx.sourceRoot,
    ctx.rootNamespace
  );
  const name = getTstsNodeNameText(node) ?? "_";

  return stampRuntimeUnionAliasCarrier(type, {
    aliasName: name,
    fullyQualifiedName: `${sourceIdentity.namespace}.${name}`,
    namespaceName: sourceIdentity.namespace,
    typeParameters: definedTstsNodes(getTstsTypeParameterNodes(node)).map(
      (tp) => getTstsNodeNameText(tp) ?? "_"
    ),
  });
};

/**
 * Convert type alias declaration.
 *
 * If the type alias is a union of object literals, this generates synthetic
 * interface declarations and rewrites the type alias to reference them.
 *
 * @returns Array of statements: [synthetic interfaces..., type alias]
 */
export const convertTypeAliasDeclaration = (
  node: TstsNode,
  ctx: ProgramContext
): readonly IrStatement[] => {
  // Convert type alias syntax through the TypeSystem.
  // Type aliases are converted through the unified type conversion path.
  const typeNode = getTstsDeclaredTypeNode(node);
  if (!typeNode) {
    return [];
  }
  const typeSyntaxId = ctx.binding.captureTypeSyntax(typeNode);
  const baseAlias: IrTypeAliasDeclaration = {
    kind: "typeAliasDeclaration",
    name: getTstsNodeNameText(node) ?? "_",
    typeParameters: convertTypeParameters(
      definedTstsNodes(getTstsTypeParameterNodes(node)),
      ctx
    ),
    type: stampAliasCarrier(
      ctx.typeSystem.typeFromSyntax(typeSyntaxId),
      node,
      ctx
    ),
    isExported: hasExportModifier(node),
    isStruct: false, // Type aliases are not structs by default
  };

  // Process for synthetic type generation (union of object literals)
  const result = processTypeAliasForSynthetics(baseAlias);

  // Return synthetics first, then the (possibly rewritten) type alias
  return [...result.syntheticInterfaces, result.typeAlias];
};
