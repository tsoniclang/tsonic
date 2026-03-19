/**
 * Declaration Type Queries & Inspection Utilities
 *
 * Contains:
 * - typeOfDecl: declared type of a declaration
 * - typeOfValueRead: type when reading a value (adds undefined for optionals)
 * - hasTypeParameters: check if declaration has type parameters
 * - getFQNameOfDecl: get fully-qualified name
 * - isTypeDecl, isInterfaceDecl, isTypeAliasToObjectLiteral: kind checks
 * - signatureHasConditionalReturn, signatureHasVariadicTypeParams: signature queries
 * - declHasTypeAnnotation: annotation check
 * - checkTsClassMemberOverride: override checking
 * - typeFromSyntax: convert captured syntax to IrType
 *
 * DAG position: depends on inference-utilities, inference-initializers,
 *               type-system-state, type-system-call-resolution
 */

import type { IrType, IrReferenceType, IrParameter } from "../types/index.js";
import * as ts from "typescript";
import {
  substituteIrType as irSubstitute,
  TypeSubstitutionMap as IrSubstitutionMap,
} from "../types/ir-substitution.js";
import type { DeclId, SignatureId, TypeSyntaxId } from "./types.js";
import { unknownType } from "./types.js";
import type { TypeSystemState, DeclKind } from "./type-system-state.js";
import { emitDiagnostic, normalizeToNominal } from "./type-system-state.js";
import { typesEqual } from "./type-system-relations.js";
import { convertTypeNode } from "./type-system-call-resolution.js";
import { makeOptionalReadType } from "./inference-utilities.js";
import { tryInferTypeFromInitializer } from "./inference-initializers.js";

// ─────────────────────────────────────────────────────────────────────────
// typeOfDecl — Get declared type of a declaration
// ─────────────────────────────────────────────────────────────────────────

export const typeOfDecl = (state: TypeSystemState, declId: DeclId): IrType => {
  // Check cache first
  const cached = state.declTypeCache.get(declId.id);
  if (cached) return cached;

  const declInfo = state.handleRegistry.getDecl(declId);
  if (!declInfo) {
    emitDiagnostic(state, "TSN5203", "Cannot resolve declaration");
    const result = unknownType;
    state.declTypeCache.set(declId.id, result);
    return result;
  }

  const effectiveValueDecl =
    (declInfo.valueDeclNode as ts.Declaration | undefined) ??
    (declInfo.declNode as ts.Declaration | undefined);
  const effectiveTypeDecl =
    (declInfo.typeDeclNode as ts.Declaration | undefined) ?? effectiveValueDecl;
  const effectiveDeclNode = effectiveValueDecl ?? effectiveTypeDecl;
  const effectiveTypeNode = ((): ts.TypeNode | undefined => {
    if (declInfo.typeNode) return declInfo.typeNode as ts.TypeNode;
    const source = effectiveDeclNode;
    if (!source) return undefined;
    if (
      ts.isVariableDeclaration(source) ||
      ts.isParameter(source) ||
      ts.isPropertyDeclaration(source) ||
      ts.isPropertySignature(source) ||
      ts.isMethodDeclaration(source) ||
      ts.isMethodSignature(source) ||
      ts.isFunctionDeclaration(source) ||
      ts.isTypeAliasDeclaration(source) ||
      ts.isGetAccessorDeclaration(source)
    ) {
      return source.type;
    }
    return undefined;
  })();
  const effectiveKind: DeclKind = (() => {
    const source = effectiveDeclNode;
    if (!source) return declInfo.kind;
    if (ts.isFunctionDeclaration(source)) return "function";
    if (ts.isVariableDeclaration(source)) return "variable";
    if (ts.isClassDeclaration(source)) return "class";
    if (ts.isInterfaceDeclaration(source)) return "interface";
    if (ts.isTypeAliasDeclaration(source)) return "typeAlias";
    if (ts.isEnumDeclaration(source)) return "enum";
    if (ts.isParameter(source)) return "parameter";
    if (
      ts.isPropertyDeclaration(source) ||
      ts.isPropertySignature(source) ||
      ts.isGetAccessorDeclaration(source) ||
      ts.isSetAccessorDeclaration(source)
    ) {
      return "property";
    }
    if (ts.isMethodDeclaration(source) || ts.isMethodSignature(source)) {
      return "method";
    }
    return declInfo.kind;
  })();

  let result: IrType;

  if (effectiveTypeNode) {
    // Explicit type annotation - convert to IR
    result = convertTypeNode(state, effectiveTypeNode);
  } else if (
    effectiveKind === "class" ||
    effectiveKind === "interface" ||
    effectiveKind === "enum"
  ) {
    // Class/interface/enum - return reference type
    result = {
      kind: "referenceType",
      name: declInfo.fqName ?? "unknown",
    } as IrReferenceType;
  } else if (effectiveKind === "function") {
    // Function without type annotation - need to build function type from signature
    // For now, return unknownType as we need the signature ID
    emitDiagnostic(
      state,
      "TSN5201",
      `Function '${declInfo.fqName ?? "unknown"}' requires explicit return type`
    );
    result = unknownType;
  } else if (effectiveKind === "variable" && effectiveDeclNode) {
    // Variable without type annotation - infer from deterministic initializer
    const inferred = tryInferTypeFromInitializer(state, effectiveDeclNode);
    if (inferred) {
      result = inferred;
    } else {
      // Not a simple literal - require explicit type annotation
      emitDiagnostic(
        state,
        "TSN5201",
        `Declaration requires explicit type annotation`
      );
      result = unknownType;
    }
  } else {
    // Parameter or other declaration without type annotation
    emitDiagnostic(
      state,
      "TSN5201",
      `Declaration requires explicit type annotation`
    );
    result = unknownType;
  }

  state.declTypeCache.set(declId.id, result);
  return result;
};

export const typeOfValueRead = (
  state: TypeSystemState,
  declId: DeclId
): IrType => {
  const declType = typeOfDecl(state, declId);
  if (declType.kind === "unknownType") {
    return declType;
  }

  const declInfo = state.handleRegistry.getDecl(declId);
  const effectiveValueDecl =
    (declInfo?.valueDeclNode as ts.Declaration | undefined) ??
    (declInfo?.declNode as ts.Declaration | undefined);

  if (
    effectiveValueDecl &&
    ((ts.isParameter(effectiveValueDecl) &&
      effectiveValueDecl.questionToken !== undefined) ||
      ((ts.isPropertyDeclaration(effectiveValueDecl) ||
        ts.isPropertySignature(effectiveValueDecl)) &&
        effectiveValueDecl.questionToken !== undefined))
  ) {
    return makeOptionalReadType(declType);
  }

  return declType;
};

// ─────────────────────────────────────────────────────────────────────────
// getFQNameOfDecl — Get fully-qualified name of declaration
// ─────────────────────────────────────────────────────────────────────────

export const getFQNameOfDecl = (
  state: TypeSystemState,
  declId: DeclId
): string | undefined => {
  const declInfo = state.handleRegistry.getDecl(declId);
  return declInfo?.fqName;
};

// ─────────────────────────────────────────────────────────────────────────
// hasTypeParameters — Check if declaration has type parameters
// ─────────────────────────────────────────────────────────────────────────

export const hasTypeParameters = (
  state: TypeSystemState,
  declId: DeclId
): boolean => {
  const declInfo = state.handleRegistry.getDecl(declId);
  if (!declInfo?.declNode) return false;

  // Check the declaration node for type parameters
  // We need to import ts to check for type parameter declarations
  // Access the declNode as any to check for typeParameters property
  const declNode = declInfo.declNode as {
    typeParameters?: readonly unknown[];
  };
  return !!(declNode.typeParameters && declNode.typeParameters.length > 0);
};

// ─────────────────────────────────────────────────────────────────────────
// isTypeDecl — Check if declaration is a type
// ─────────────────────────────────────────────────────────────────────────

export const isTypeDecl = (state: TypeSystemState, declId: DeclId): boolean => {
  const declInfo = state.handleRegistry.getDecl(declId);
  if (!declInfo) return false;

  const typeKinds: readonly DeclKind[] = [
    "interface",
    "class",
    "typeAlias",
    "enum",
  ];
  return typeKinds.includes(declInfo.kind);
};

// ─────────────────────────────────────────────────────────────────────────
// isInterfaceDecl — Check if declaration is an interface
// ─────────────────────────────────────────────────────────────────────────

export const isInterfaceDecl = (
  state: TypeSystemState,
  declId: DeclId
): boolean => {
  const declInfo = state.handleRegistry.getDecl(declId);
  return declInfo?.kind === "interface";
};

// ─────────────────────────────────────────────────────────────────────────
// isTypeAliasToObjectLiteral — Check if type alias points to object literal
// ─────────────────────────────────────────────────────────────────────────

export const isTypeAliasToObjectLiteral = (
  state: TypeSystemState,
  declId: DeclId
): boolean => {
  const declInfo = state.handleRegistry.getDecl(declId);
  if (!declInfo || declInfo.kind !== "typeAlias") return false;

  // Check if the typeNode is a type literal node
  // We need to access the declNode to get the type alias declaration
  const declNode = declInfo.declNode as
    | { type?: { kind?: number } }
    | undefined;
  if (!declNode?.type) return false;

  return declNode.type.kind === ts.SyntaxKind.TypeLiteral;
};

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
// declHasTypeAnnotation — Check if declaration has explicit type
// ─────────────────────────────────────────────────────────────────────────

export const declHasTypeAnnotation = (
  state: TypeSystemState,
  declId: DeclId
): boolean => {
  const declInfo = state.handleRegistry.getDecl(declId);
  return declInfo?.typeNode !== undefined;
};

// ─────────────────────────────────────────────────────────────────────────
// checkTsClassMemberOverride — Check if member can be overridden
// ─────────────────────────────────────────────────────────────────────────

/**
 * Check if a class member overrides a base class member.
 *
 * ALICE'S SPEC: Uses captured ClassMemberNames (pure data) from Binding.
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
 * ALICE'S SPEC (Phase 2): TypeSystem receives opaque handles, not ts.TypeNode.
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
  // Phase 5: convertTypeNode accepts unknown, cast is inside type-system/internal
  return convertTypeNode(state, syntaxInfo.typeNode);
};
