/**
 * Type alias declaration converter
 */

import * as ts from "typescript";
import {
  IrType,
  IrStatement,
  IrTypeAliasDeclaration,
  stampRuntimeUnionAliasCarrier,
} from "../../../types.js";
import { hasExportModifier, convertTypeParameters } from "../helpers.js";
import { processTypeAliasForSynthetics } from "../../synthetic-types.js";
import type { ProgramContext } from "../../../program-context.js";
import { resolveSourceFileIdentity } from "../../../../program/source-file-identity.js";

const stampAliasCarrier = (
  type: IrType,
  node: ts.TypeAliasDeclaration,
  ctx: ProgramContext
): IrType => {
  const sourceIdentity = resolveSourceFileIdentity(
    node.getSourceFile().fileName,
    ctx.sourceRoot,
    ctx.rootNamespace
  );

  return stampRuntimeUnionAliasCarrier(type, {
    aliasName: node.name.text,
    fullyQualifiedName: `${sourceIdentity.namespace}.${node.name.text}`,
    namespaceName: sourceIdentity.namespace,
    typeParameters: (node.typeParameters ?? []).map((tp) => tp.name.text),
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
  node: ts.TypeAliasDeclaration,
  ctx: ProgramContext
): readonly IrStatement[] => {
  // Convert type alias syntax through the TypeSystem.
  // Type aliases are converted through the unified type conversion path.
  const typeSyntaxId = ctx.binding.captureTypeSyntax(node.type);
  const baseAlias: IrTypeAliasDeclaration = {
    kind: "typeAliasDeclaration",
    name: node.name.text,
    typeParameters: convertTypeParameters(node.typeParameters, ctx),
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
