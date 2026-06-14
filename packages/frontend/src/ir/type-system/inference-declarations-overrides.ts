/**
 * Override checking, signature queries, and type syntax conversion.
 *
 * Contains signatureHasConditionalReturn, signatureHasVariadicTypeParams,
 * checkTsClassMemberOverride, and typeFromSyntax.
 *
 * DAG position: depends on type-system-state, type-system-relations
 */

import type { IrType, IrParameter } from "../types/index.js";
import { stampRuntimeUnionAliasCarrier } from "../types/index.js";
import type { TstsNode } from "@tsonic/tsts";
import {
  getTstsContainingSourceFileName,
  getTstsDeclaredTypeNode,
  getTstsNodeNameText,
  getTstsTypeArguments,
  getTstsTypeParameterNodes,
  isTstsDeclarationFileNode,
  TstsSyntax,
} from "@tsonic/tsts";
import {
  substituteIrType as irSubstitute,
  TypeSubstitutionMap as IrSubstitutionMap,
} from "../types/ir-substitution.js";
import type { DeclId, SignatureId, TypeSyntaxId } from "./types.js";
import type { TypeSystemState } from "./type-system-state.js";
import {
  normalizeToNominal,
  resolveTypeIdByName,
} from "./type-system-state.js";
import { typesEqual } from "./type-system-relations.js";
import { convertTypeNode } from "./type-system-call-resolution.js";
import { resolveSourceFileIdentity } from "../../program/source-file-identity.js";

// ─────────────────────────────────────────────────────────────────────────
// signatureHasConditionalReturn — Check for conditional return type
// ─────────────────────────────────────────────────────────────────────────

export const signatureHasConditionalReturn = (
  state: TypeSystemState,
  sigId: SignatureId
): boolean => {
  const sigInfo = state.handleRegistry.getSignature(sigId);
  if (!sigInfo) return false;

  const returnTypeNode = sigInfo.returnTypeNode as TstsNode | undefined;
  if (!returnTypeNode) return false;

  return returnTypeNode.Kind === TstsSyntax.KindConditionalType;
};

// ─────────────────────────────────────────────────────────────────────────
// signatureHasVariadicTypeParams — Check for variadic type parameters
// ─────────────────────────────────────────────────────────────────────────

export const signatureHasVariadicTypeParams = (
  state: TypeSystemState,
  sigId: SignatureId
): boolean => {
  const sigInfo = state.handleRegistry.getSignature(sigId);
  if (!sigInfo) return false;

  if (!sigInfo.typeParameters) return false;

  for (const typeParam of sigInfo.typeParameters) {
    const constraintNode = typeParam.constraintNode as TstsNode | undefined;
    if (!constraintNode) continue;

    // Check if constraint is an array type (variadic pattern: T extends unknown[])
    if (constraintNode.Kind === TstsSyntax.KindArrayType) {
      const elementType = TstsSyntax.AsArrayTypeNode(
        constraintNode
      )?.ElementType;
      if (!elementType) continue;

      // Check for unknown[] or any[] constraint
      if (
        elementType.Kind === TstsSyntax.KindUnknownKeyword ||
        elementType.Kind === TstsSyntax.KindAnyKeyword
      ) {
        return true;
      }

      // Also check for type reference to "unknown" or "any"
      const typeName =
        TstsSyntax.IsTypeReferenceNode(elementType)
          ? getTstsNodeNameText(elementType)
          : undefined;
      if (typeName === "unknown" || typeName === "any") {
        return true;
      }
    }
  }

  return false;
};

// ─────────────────────────────────────────────────────────────────────────
// checkTsClassMemberOverride — Check if member can be overridden
// ─────────────────────────────────────────────────────────────────────────

/**
 * Check if a class member overrides a base class member.
 *
 * Uses captured ClassMemberNames from Binding.
 * No TS AST inspection, no SyntaxKind numbers. TS-version safe.
 */
export const checkTsClassMemberOverride = (
  state: TypeSystemState,
  declId: DeclId,
  memberName: string,
  memberKind: "method" | "property",
  parameters?: readonly IrParameter[],
  baseClassType?: IrType
): { isOverride: boolean; isShadow: boolean } => {
  const declInfo = state.handleRegistry.getDecl(declId);
  const members = declInfo?.classMemberNames;

  // No class member info available
  if (!members) {
    return { isOverride: false, isShadow: false };
  }

  if (memberKind === "method") {
    if (!members.methods.has(memberName)) {
      return { isOverride: false, isShadow: false };
    }

    if (!parameters) {
      return { isOverride: true, isShadow: false };
    }

    const signatures = members.methodSignatures.get(memberName) ?? [];
    if (signatures.length === 0) {
      return { isOverride: true, isShadow: false };
    }

    const baseSubstitution = buildCapturedBaseClassSubstitution(
      members.typeParameters,
      baseClassType
    );

    const hasCompatibleBaseSignature = signatures.some((signature) =>
      isCapturedMethodOverrideCompatible(
        state,
        signature.parameters,
        parameters,
        baseSubstitution
      )
    );
    return hasCompatibleBaseSignature
      ? { isOverride: true, isShadow: false }
      : { isOverride: false, isShadow: false };
  }

  // In TypeScript, properties/accessors override by name.
  return members.properties.has(memberName)
    ? { isOverride: true, isShadow: false }
    : { isOverride: false, isShadow: false };
};

const capturedParameterTypeToIrType = (
  state: TypeSystemState,
  typeNode: unknown | undefined
): IrType | undefined => {
  if (!typeNode) return undefined;
  return convertTypeNode(state, typeNode);
};

const areMethodParameterTypesOverrideCompatible = (
  state: TypeSystemState,
  baseType: IrType | undefined,
  derivedType: IrType | undefined
): boolean => {
  if (!baseType || !derivedType) {
    return true;
  }

  if (typesEqual(baseType, derivedType)) {
    return true;
  }

  const baseNominal = normalizeToNominal(state, baseType);
  const derivedNominal = normalizeToNominal(state, derivedType);
  return (
    !!baseNominal &&
    !!derivedNominal &&
    baseNominal.typeId.stableId === derivedNominal.typeId.stableId
  );
};

const isCapturedMethodOverrideCompatible = (
  state: TypeSystemState,
  baseParameters: readonly {
    readonly typeNode?: unknown;
    readonly isRest: boolean;
  }[],
  derivedParameters: readonly IrParameter[],
  baseSubstitution?: IrSubstitutionMap
): boolean => {
  if (baseParameters.length !== derivedParameters.length) {
    return false;
  }

  for (let index = 0; index < baseParameters.length; index += 1) {
    const baseParameter = baseParameters[index];
    const derivedParameter = derivedParameters[index];
    if (!baseParameter || !derivedParameter) {
      return false;
    }

    if (baseParameter.isRest !== derivedParameter.isRest) {
      return false;
    }

    const baseType = capturedParameterTypeToIrType(
      state,
      baseParameter.typeNode
    );
    const substitutedBaseType =
      baseType && baseSubstitution && baseSubstitution.size > 0
        ? irSubstitute(baseType, baseSubstitution)
        : baseType;
    if (
      !areMethodParameterTypesOverrideCompatible(
        state,
        substitutedBaseType,
        derivedParameter.type
      )
    ) {
      return false;
    }
  }

  return true;
};

const buildCapturedBaseClassSubstitution = (
  typeParameters: readonly string[],
  baseClassType: IrType | undefined
): IrSubstitutionMap | undefined => {
  if (typeParameters.length === 0) {
    return undefined;
  }

  if (
    !baseClassType ||
    baseClassType.kind !== "referenceType" ||
    !baseClassType.typeArguments ||
    baseClassType.typeArguments.length === 0
  ) {
    return undefined;
  }

  const substitution = new Map<string, IrType>();
  for (let index = 0; index < typeParameters.length; index += 1) {
    const paramName = typeParameters[index];
    const argType = baseClassType.typeArguments[index];
    if (!paramName || !argType) continue;
    substitution.set(paramName, argType);
  }

  return substitution.size > 0 ? substitution : undefined;
};

// ─────────────────────────────────────────────────────────────────────────
// typeFromSyntax — Convert captured type syntax to IrType
// ─────────────────────────────────────────────────────────────────────────

/**
 * Convert a captured type syntax to IrType.
 *
 * This method takes a TypeSyntaxId handle (opaque to caller) and looks up
 * the captured TypeNode in the HandleRegistry, then converts it.
 *
 * TypeSystem receives opaque handles, not raw source syntax nodes.
 */
export const typeFromSyntax = (
  state: TypeSystemState,
  typeSyntaxId: TypeSyntaxId
): IrType => {
  const syntaxInfo = state.handleRegistry.getTypeSyntax(typeSyntaxId);
  if (!syntaxInfo) {
    // Invalid handle - return unknownType
    return { kind: "unknownType" };
  }

  const rawType = state.convertTypeNodeRaw(syntaxInfo.typeNode);
  if (
    rawType.kind === "unionType" &&
    syntaxInfo.referenceDeclId &&
    TstsSyntax.IsTypeReferenceNode(syntaxInfo.typeNode as TstsNode)
  ) {
    const declInfo = state.handleRegistry.getDecl(syntaxInfo.referenceDeclId);
    const declNode = (declInfo?.typeDeclNode ?? declInfo?.declNode) as
      | TstsNode
      | undefined;
    const aliasBody =
      declNode && TstsSyntax.IsTypeAliasDeclaration(declNode)
        ? (() => {
            let current = getTstsDeclaredTypeNode(declNode);
            while (current && TstsSyntax.IsParenthesizedTypeNode(current)) {
              current = TstsSyntax.AsParenthesizedTypeNode(current)?.Type;
            }
            return current;
          })()
        : undefined;
    if (
      declNode &&
      TstsSyntax.IsTypeAliasDeclaration(declNode) &&
      !isTstsDeclarationFileNode(declNode) &&
      aliasBody &&
      TstsSyntax.IsUnionTypeNode(aliasBody)
    ) {
      const aliasName = getTstsNodeNameText(declNode);
      if (!aliasName) return convertTypeNode(state, syntaxInfo.typeNode);
      return stampRuntimeUnionAliasCarrier(
        convertTypeNode(state, syntaxInfo.typeNode),
        {
          aliasName,
          fullyQualifiedName: declInfo?.fqName ?? aliasName,
          typeParameters: getTstsTypeParameterNodes(declNode).flatMap(
            (typeParameter) => getTstsNodeNameText(typeParameter) ?? []
          ),
          typeArguments: getTstsTypeArguments(
            syntaxInfo.typeNode as TstsNode
          ).flatMap((typeArgument) =>
            typeArgument ? [convertTypeNode(state, typeArgument)] : []
          ),
        }
      );
    }
  }
  if (rawType.kind !== "referenceType" || !syntaxInfo.referenceDeclId) {
    return convertTypeNode(state, syntaxInfo.typeNode);
  }

  const declInfo = state.handleRegistry.getDecl(syntaxInfo.referenceDeclId);
  const declNode = (declInfo?.typeDeclNode ?? declInfo?.declNode) as
    | TstsNode
    | undefined;
  if (!declNode || isTstsDeclarationFileNode(declNode)) {
    return convertTypeNode(state, syntaxInfo.typeNode);
  }

  const declName = getTstsNodeNameText(declNode);
  if (!declName) {
    return convertTypeNode(state, syntaxInfo.typeNode);
  }

  const sourceFileName = getTstsContainingSourceFileName(declNode);
  if (!sourceFileName) {
    return convertTypeNode(state, syntaxInfo.typeNode);
  }

  const sourceIdentity = resolveSourceFileIdentity(
    sourceFileName,
    state.sourceRoot,
    state.rootNamespace
  );
  const fqName = `${sourceIdentity.namespace}.${declName}`;
  const nominalEntry = state.typeRegistry.resolveNominal(fqName);
  if (!nominalEntry) {
    return convertTypeNode(state, syntaxInfo.typeNode);
  }

  const exactTargetName =
    TstsSyntax.IsTypeAliasDeclaration(declNode) &&
    (() => {
      const typeNode = getTstsDeclaredTypeNode(declNode);
      return !!typeNode && TstsSyntax.IsTypeLiteralNode(typeNode);
    })()
      ? `${nominalEntry.fullyQualifiedName}__Alias`
      : nominalEntry.fullyQualifiedName;
  const exactTypeId = resolveTypeIdByName(
    state,
    exactTargetName,
    rawType.typeArguments?.length
  );
  if (!exactTypeId) {
    return convertTypeNode(state, syntaxInfo.typeNode);
  }

  const converted = convertTypeNode(state, syntaxInfo.typeNode);
  if (converted.kind !== "referenceType") {
    return converted;
  }

  return {
    ...converted,
    typeId: exactTypeId,
  };
};
