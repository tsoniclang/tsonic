/**
 * Binding Layer — Constructor Signature Resolution.
 *
 * This module uses TSTS syntax and checker-facing semantic queries only.
 */

import type { TstsNode } from "@tsonic/tsts";
import {
  getTstsNodeNameText,
  getTstsTypeParameterNodes,
  TstsSyntax,
} from "@tsonic/tsts";
import type { SignatureId } from "../type-system/types.js";
import type { BindingContext } from "./binding-registry.js";
import {
  getOrCreateDeclId,
  getOrCreateSignatureId,
  getOrCreateSyntheticConstructorSignatureId,
  resolveTransparentAliases,
} from "./binding-registry.js";
import {
  convertTypeParameterDeclarations,
  normalizeCapturedDeclaringTypeName,
} from "./binding-helpers.js";

const concreteTstsNodes = (
  nodes: readonly (TstsNode | undefined)[]
): readonly TstsNode[] =>
  nodes.filter((node): node is TstsNode => node !== undefined);

const getExpressionTargetSymbol = (
  ctx: BindingContext,
  expression: TstsNode | undefined
) => {
  if (!expression) return undefined;
  if (TstsSyntax.IsIdentifier(expression)) {
    return ctx.sourceSemantics.getSymbol(expression);
  }
  if (TstsSyntax.IsPropertyAccessExpression(expression)) {
    const name = TstsSyntax.Node_Name(expression);
    return name ? ctx.sourceSemantics.getSymbol(name) : undefined;
  }
  return undefined;
};

export const resolveConstructorSignature = (
  ctx: BindingContext,
  node: TstsNode
): SignatureId | undefined => {
  const expression = TstsSyntax.Node_Expression(node);
  const signature = ctx.sourceSemantics.getResolvedSignature(node);
  const resolvedDeclarationNode = (() => {
    const symbol = getExpressionTargetSymbol(ctx, expression);
    const resolvedSymbol = symbol
      ? resolveTransparentAliases(ctx, symbol)
      : undefined;
    return resolvedSymbol
      ? ctx.sourceSemantics.getSymbolDeclarations(resolvedSymbol)[0]
      : undefined;
  })();
  const declaringTypeName = (() => {
    const symbol = getExpressionTargetSymbol(ctx, expression);
    const resolvedSymbol = symbol
      ? resolveTransparentAliases(ctx, symbol)
      : undefined;
    return (
      getClassDeclaringTypeName(ctx, resolvedDeclarationNode) ??
      (resolvedSymbol ? resolvedSymbol.Name : undefined) ??
      getTstsNodeNameText(expression)
    );
  })();
  const declaration = ctx.sourceSemantics.getSignatureDeclaration(signature);
  const constructorMetadata = getDeclaredConstructorMetadata(ctx, declaration);
  if (!signature || !declaration) {
    const canSynthesizeConstructor =
      constructorMetadata !== undefined ||
      resolvedDeclarationNode !== undefined;
    if (!canSynthesizeConstructor) {
      return undefined;
    }
    const syntheticDeclaringTypeName =
      constructorMetadata?.declaringTypeTsName ?? declaringTypeName;
    return syntheticDeclaringTypeName
      ? getOrCreateSyntheticConstructorSignatureId(
          ctx,
          node,
          syntheticDeclaringTypeName,
          constructorMetadata?.typeParameters,
          constructorMetadata?.declaringTypeParameterNames
        )
      : undefined;
  }

  const sigId = getOrCreateSignatureId(ctx, signature);
  const entry = ctx.signatureMap.get(sigId.id);
  if (!entry) return sigId;

  if (constructorMetadata) {
    ctx.signatureMap.set(sigId.id, {
      ...entry,
      declaringTypeTsName: constructorMetadata.declaringTypeTsName,
      declaringMemberName: "constructor",
      typeParameters: constructorMetadata.typeParameters ?? entry.typeParameters,
      declaringTypeParameterNames:
        constructorMetadata.declaringTypeParameterNames ??
        entry.declaringTypeParameterNames,
    });
    return sigId;
  }

  if (entry.decl) return sigId;

  if (declaringTypeName) {
    ctx.signatureMap.set(sigId.id, {
      ...entry,
      declaringTypeTsName: declaringTypeName,
      declaringMemberName: "constructor",
    });
  }

  return sigId;
};

type ConstructorMetadata = {
  readonly declaringTypeTsName: string;
  readonly typeParameters?: ReturnType<typeof convertTypeParameterDeclarations>;
  readonly declaringTypeParameterNames?: readonly string[];
};

const getDeclaredConstructorMetadata = (
  ctx: BindingContext,
  declaration: TstsNode | undefined
): ConstructorMetadata | undefined => {
  if (!declaration) return undefined;

  if (TstsSyntax.IsConstructorDeclaration(declaration)) {
    const parent = declaration.Parent;
    if (!parent || !TstsSyntax.IsClassDeclaration(parent)) return undefined;

    const parentSymbol = ctx.sourceSemantics.getSymbol(parent);
    const declId = parentSymbol
      ? getOrCreateDeclId(ctx, resolveTransparentAliases(ctx, parentSymbol))
      : undefined;
    const parentName = getTstsNodeNameText(parent);
    const declaringTypeTsName =
      (declId ? ctx.declMap.get(declId.id)?.fqName : undefined) ??
      (parentName ? normalizeCapturedDeclaringTypeName(parentName) : undefined);
    if (!declaringTypeTsName) return undefined;

    const typeParameters = concreteTstsNodes(getTstsTypeParameterNodes(parent));
    return {
      declaringTypeTsName,
      typeParameters: convertTypeParameterDeclarations(typeParameters),
      declaringTypeParameterNames: typeParameters
        .map(getTstsNodeNameText)
        .filter((name): name is string => name !== undefined),
    };
  }

  if (TstsSyntax.IsConstructSignatureDeclaration(declaration)) {
    const parent = declaration.Parent;
    if (parent && TstsSyntax.IsTypeLiteralNode(parent)) {
      const owner = parent.Parent;
      const ownerName =
        TstsSyntax.IsVariableDeclaration(owner) ||
        owner?.Kind === TstsSyntax.KindPropertySignature ||
        TstsSyntax.IsPropertyDeclaration(owner) ||
        TstsSyntax.IsTypeAliasDeclaration(owner)
          ? getTstsNodeNameText(owner)
          : undefined;
      if (!ownerName) return undefined;
      const typeParameters =
        TstsSyntax.IsTypeAliasDeclaration(owner)
          ? concreteTstsNodes(getTstsTypeParameterNodes(owner))
          : concreteTstsNodes(getTstsTypeParameterNodes(declaration));
      return {
        declaringTypeTsName: normalizeCapturedDeclaringTypeName(ownerName),
        typeParameters: convertTypeParameterDeclarations(typeParameters),
        declaringTypeParameterNames: typeParameters
          .map(getTstsNodeNameText)
          .filter((name): name is string => name !== undefined),
      };
    }

    if (!TstsSyntax.IsInterfaceDeclaration(parent)) return undefined;
    const parentName = getTstsNodeNameText(parent);
    if (!parentName) return undefined;
    const typeParameters = concreteTstsNodes(
      getTstsTypeParameterNodes(declaration)
    );
    return {
      declaringTypeTsName: normalizeCapturedDeclaringTypeName(parentName),
      typeParameters: convertTypeParameterDeclarations(typeParameters),
      declaringTypeParameterNames: typeParameters
        .map(getTstsNodeNameText)
        .filter((name): name is string => name !== undefined),
    };
  }

  return undefined;
};

const getClassDeclaringTypeName = (
  ctx: BindingContext,
  declaration: TstsNode | undefined
): string | undefined => {
  if (!declaration || !TstsSyntax.IsClassDeclaration(declaration)) {
    return undefined;
  }
  const symbol = ctx.sourceSemantics.getSymbol(declaration);
  if (symbol) {
    const declId = getOrCreateDeclId(ctx, resolveTransparentAliases(ctx, symbol));
    return ctx.declMap.get(declId.id)?.fqName;
  }
  return getTstsNodeNameText(declaration);
};
