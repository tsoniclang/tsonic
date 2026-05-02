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
import * as ts from "typescript";
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

  const returnTypeNode = sigInfo.returnTypeNode as
    | { kind?: number }
    | undefined;
  if (!returnTypeNode) return false;

  return returnTypeNode.kind === ts.SyntaxKind.ConditionalType;
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
    const constraintNode = typeParam.constraintNode as
      | {
          kind?: number;
          elementType?: { kind?: number; typeName?: { text?: string } };
        }
      | undefined;
    if (!constraintNode) continue;

    // Check if constraint is an array type (variadic pattern: T extends unknown[])
    if (constraintNode.kind === ts.SyntaxKind.ArrayType) {
      const elementType = constraintNode.elementType;
      if (!elementType) continue;

      // Check for unknown[] or any[] constraint
      if (
        elementType.kind === ts.SyntaxKind.UnknownKeyword ||
        elementType.kind === ts.SyntaxKind.AnyKeyword
      ) {
        return true;
      }

      // Also check for type reference to "unknown" or "any"
      const typeName = elementType.typeName?.text;
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
 * TypeSystem receives opaque handles, not ts.TypeNode.
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
    ts.isTypeReferenceNode(syntaxInfo.typeNode as ts.Node)
  ) {
    const declInfo = state.handleRegistry.getDecl(syntaxInfo.referenceDeclId);
    const declNode = (declInfo?.typeDeclNode ?? declInfo?.declNode) as
      | ts.Declaration
      | undefined;
    const aliasBody =
      declNode && ts.isTypeAliasDeclaration(declNode)
        ? (() => {
            let current: ts.TypeNode = declNode.type;
            while (ts.isParenthesizedTypeNode(current)) {
              current = current.type;
            }
            return current;
          })()
        : undefined;
    if (
      declNode &&
      ts.isTypeAliasDeclaration(declNode) &&
      !declNode.getSourceFile().isDeclarationFile &&
      aliasBody &&
      ts.isUnionTypeNode(aliasBody)
    ) {
      return stampRuntimeUnionAliasCarrier(
        convertTypeNode(state, syntaxInfo.typeNode),
        {
          aliasName: declNode.name.text,
          fullyQualifiedName: declInfo?.fqName ?? declNode.name.text,
          typeParameters: (declNode.typeParameters ?? []).map(
            (tp) => tp.name.text
          ),
          typeArguments: (
            (syntaxInfo.typeNode as ts.TypeReferenceNode).typeArguments ?? []
          ).map((typeArgument) => convertTypeNode(state, typeArgument)),
        }
      );
    }
  }
  if (rawType.kind !== "referenceType" || !syntaxInfo.referenceDeclId) {
    return convertTypeNode(state, syntaxInfo.typeNode);
  }

  const declInfo = state.handleRegistry.getDecl(syntaxInfo.referenceDeclId);
  const declNode = (declInfo?.typeDeclNode ?? declInfo?.declNode) as
    | ts.Declaration
    | undefined;
  if (!declNode || declNode.getSourceFile().isDeclarationFile) {
    return convertTypeNode(state, syntaxInfo.typeNode);
  }

  const namedDecl = declNode as ts.NamedDeclaration;
  const declName =
    namedDecl.name && ts.isIdentifier(namedDecl.name)
      ? namedDecl.name.text
      : undefined;
  if (!declName) {
    return convertTypeNode(state, syntaxInfo.typeNode);
  }

  const sourceIdentity = resolveSourceFileIdentity(
    declNode.getSourceFile().fileName,
    state.sourceRoot,
    state.rootNamespace
  );
  const fqName = `${sourceIdentity.namespace}.${declName}`;
  const nominalEntry = state.typeRegistry.resolveNominal(fqName);
  if (!nominalEntry) {
    return convertTypeNode(state, syntaxInfo.typeNode);
  }

  const exactClrName =
    ts.isTypeAliasDeclaration(declNode) && ts.isTypeLiteralNode(declNode.type)
      ? `${nominalEntry.fullyQualifiedName}__Alias`
      : nominalEntry.fullyQualifiedName;
  const exactTypeId = resolveTypeIdByName(
    state,
    exactClrName,
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
