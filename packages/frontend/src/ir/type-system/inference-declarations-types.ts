/**
 * Declaration type queries — typeOfDecl, typeOfValueRead, getFQNameOfDecl,
 * hasTypeParameters, isTypeDecl, isInterfaceDecl, isTypeAliasToObjectLiteral,
 * declHasTypeAnnotation.
 *
 * DAG position: depends on inference-utilities, inference-initializers,
 *               type-system-state
 */

import type {
  IrType,
  IrReferenceType,
  IrFunctionType,
  IrTypeParameter,
} from "../types/index.js";
import * as ts from "typescript";
import type { DeclId } from "./types.js";
import { unknownType } from "./types.js";
import type { TypeSystemState, DeclKind } from "./type-system-state.js";
import { emitDiagnostic } from "./type-system-state.js";
import { convertTypeNode } from "./type-system-call-resolution.js";
import { makeOptionalReadType } from "./inference-utilities.js";
import { tryInferTypeFromInitializer } from "./inference-initializers.js";

const convertSignatureTypeParameters = (
  state: TypeSystemState,
  declaration: ts.SignatureDeclarationBase
): readonly IrTypeParameter[] | undefined => {
  if (!declaration.typeParameters || declaration.typeParameters.length === 0) {
    return undefined;
  }

  return declaration.typeParameters.map((typeParameter) => ({
    kind: "typeParameter",
    name: typeParameter.name.text,
    constraint: typeParameter.constraint
      ? convertTypeNode(state, typeParameter.constraint)
      : undefined,
    default: typeParameter.default
      ? convertTypeNode(state, typeParameter.default)
      : undefined,
    variance: undefined,
    isStructuralConstraint:
      !!typeParameter.constraint && ts.isTypeLiteralNode(typeParameter.constraint),
    structuralMembers: undefined,
  }));
};

const buildFunctionTypeFromSignatureDeclaration = (
  state: TypeSystemState,
  declaration: ts.SignatureDeclarationBase
): IrFunctionType => ({
  kind: "functionType",
  typeParameters: convertSignatureTypeParameters(state, declaration),
  parameters: declaration.parameters.map((parameter) => ({
    kind: "parameter",
    pattern: ts.isIdentifier(parameter.name)
      ? { kind: "identifierPattern", name: parameter.name.text }
      : { kind: "identifierPattern", name: `p${parameter.pos}` },
    type: parameter.type ? convertTypeNode(state, parameter.type) : unknownType,
    initializer: undefined,
    isOptional: !!parameter.questionToken || !!parameter.initializer,
    isRest: !!parameter.dotDotDotToken,
    passing: "value",
  })),
  returnType: declaration.type
    ? convertTypeNode(state, declaration.type)
    : unknownType,
});

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
  const effectiveFunctionValueDecl =
    effectiveValueDecl &&
    ts.isVariableDeclaration(effectiveValueDecl) &&
    effectiveValueDecl.initializer &&
    (ts.isFunctionExpression(effectiveValueDecl.initializer) ||
      ts.isArrowFunction(effectiveValueDecl.initializer))
      ? effectiveValueDecl.initializer
      : effectiveValueDecl;
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

  if (
    effectiveFunctionValueDecl &&
    (ts.isFunctionDeclaration(effectiveFunctionValueDecl) ||
      ts.isMethodDeclaration(effectiveFunctionValueDecl) ||
      ts.isFunctionExpression(effectiveFunctionValueDecl) ||
      ts.isArrowFunction(effectiveFunctionValueDecl))
  ) {
    if (!effectiveFunctionValueDecl.type) {
      emitDiagnostic(
        state,
        "TSN5201",
        `Function '${declInfo.fqName ?? "unknown"}' requires explicit return type`
      );
    }
    result = buildFunctionTypeFromSignatureDeclaration(
      state,
      effectiveFunctionValueDecl
    );
  } else if (effectiveTypeNode) {
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

  const declNode = declInfo.declNode as
    | { type?: { kind?: number } }
    | undefined;
  if (!declNode?.type) return false;

  return declNode.type.kind === ts.SyntaxKind.TypeLiteral;
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
