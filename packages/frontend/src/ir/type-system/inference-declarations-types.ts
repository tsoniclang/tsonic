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
  IrInterfaceMember,
} from "../types/index.js";
import * as ts from "typescript";
import type { DeclId } from "./types.js";
import { unknownType } from "./types.js";
import type { TypeSystemState, DeclKind } from "./type-system-state.js";
import { emitDiagnostic } from "./type-system-state.js";
import { resolveTypeIdByName } from "./type-system-state.js";
import { convertTypeNode } from "./type-system-call-resolution.js";
import {
  buildCallableOverloadFamilyType,
  hasStaticModifier,
  makeOptionalReadType,
} from "./inference-utilities.js";
import { tryInferTypeFromInitializer } from "./inference-initializers.js";
import {
  getMembersFromType,
  memberValueType,
} from "./internal/type-converter/type-operators.js";
import {
  isOverloadStubImplementation,
  isOverloadSurfaceDeclaration,
} from "../syntax/overload-stubs.js";
import { tryResolveDeterministicPropertyName } from "../syntax/property-names.js";

const CATCH_VARIABLE_EXCEPTION_TYPE: IrReferenceType = {
  kind: "referenceType",
  name: "System.Exception",
  resolvedClrType: "global::System.Exception",
};

const isCatchVariableDeclaration = (
  declaration: ts.Declaration | undefined
): declaration is ts.VariableDeclaration =>
  !!declaration &&
  ts.isVariableDeclaration(declaration) &&
  ts.isCatchClause(declaration.parent);

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
      !!typeParameter.constraint &&
      ts.isTypeLiteralNode(typeParameter.constraint),
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

const getOverloadSurfaceFamily = (
  declaration: ts.FunctionDeclaration | ts.MethodDeclaration
): readonly ts.SignatureDeclarationBase[] | undefined => {
  if (!declaration.name) {
    return undefined;
  }

  if (ts.isFunctionDeclaration(declaration)) {
    const parent = declaration.parent;
    if (!ts.isSourceFile(parent)) {
      return undefined;
    }

    const family = parent.statements.filter(
      (statement): statement is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(statement) &&
        statement.name?.text === declaration.name?.text
    );
    if (family.length === 0) {
      return undefined;
    }

    const overloadSurface = family.filter(isOverloadSurfaceDeclaration);
    return overloadSurface.length > 0 ? overloadSurface : undefined;
  }

  const parent = declaration.parent;
  if (!ts.isClassDeclaration(parent)) {
    return undefined;
  }

  const methodName = tryResolveDeterministicPropertyName(declaration.name);
  if (!methodName) {
    return undefined;
  }
  const family = parent.members.filter(
    (member): member is ts.MethodDeclaration =>
      ts.isMethodDeclaration(member) &&
      tryResolveDeterministicPropertyName(member.name) === methodName &&
      hasStaticModifier(member) === hasStaticModifier(declaration)
  );
  if (family.length === 0) {
    return undefined;
  }

  const overloadSurface = family.filter(isOverloadSurfaceDeclaration);
  return overloadSurface.length > 0 ? overloadSurface : undefined;
};

const getNamedRuntimeDeclarationDeclId = (
  state: TypeSystemState,
  declaration: ts.Declaration
): DeclId | undefined => {
  if (
    ts.isFunctionDeclaration(declaration) ||
    ts.isClassDeclaration(declaration) ||
    ts.isEnumDeclaration(declaration)
  ) {
    return declaration.name && ts.isIdentifier(declaration.name)
      ? state.resolveIdentifier(declaration.name)
      : undefined;
  }

  if (
    ts.isVariableDeclaration(declaration) &&
    ts.isIdentifier(declaration.name)
  ) {
    return state.resolveIdentifier(declaration.name);
  }

  return undefined;
};

const buildModuleNamespaceTypeFromSymbol = (
  state: TypeSystemState,
  input: ts.Symbol,
  seen: Set<ts.Symbol>
): IrType => {
  const moduleSymbol =
    input.flags & ts.SymbolFlags.Alias
      ? state.checker.getAliasedSymbol(input)
      : input;

  if (seen.has(moduleSymbol)) {
    emitDiagnostic(
      state,
      "TSN5203",
      `Circular module namespace export surface is not supported deterministically`
    );
    return unknownType;
  }

  seen.add(moduleSymbol);

  const exportSymbols = [
    ...state.checker.getExportsOfModule(moduleSymbol),
  ].sort((left, right) => left.getName().localeCompare(right.getName()));

  const members: IrInterfaceMember[] = [];

  for (const exportSymbol of exportSymbols) {
    const actualSymbol =
      exportSymbol.flags & ts.SymbolFlags.Alias
        ? state.checker.getAliasedSymbol(exportSymbol)
        : exportSymbol;

    if ((actualSymbol.flags & ts.SymbolFlags.Value) === 0) {
      continue;
    }

    const memberType = (() => {
      if (
        actualSymbol.flags &
        (ts.SymbolFlags.ValueModule | ts.SymbolFlags.NamespaceModule)
      ) {
        return buildModuleNamespaceTypeFromSymbol(state, actualSymbol, seen);
      }

      for (const declaration of actualSymbol.getDeclarations() ?? []) {
        const declId = getNamedRuntimeDeclarationDeclId(state, declaration);
        if (!declId) {
          continue;
        }
        return typeOfDecl(state, declId);
      }

      return undefined;
    })();

    if (!memberType || memberType.kind === "unknownType") {
      seen.delete(moduleSymbol);
      emitDiagnostic(
        state,
        "TSN5203",
        `Namespace import export '${exportSymbol.getName()}' could not be represented deterministically`
      );
      return unknownType;
    }

    members.push({
      kind: "propertySignature",
      name: exportSymbol.getName(),
      type: memberType,
      isOptional: false,
      isReadonly: true,
    });
  }

  seen.delete(moduleSymbol);
  return {
    kind: "objectType",
    members,
  };
};

const buildNamespaceImportType = (
  state: TypeSystemState,
  declaration: ts.NamespaceImport
): IrType => {
  const importClause = declaration.parent;
  const importDeclaration = importClause.parent;

  if (
    !ts.isImportClause(importClause) ||
    !ts.isImportDeclaration(importDeclaration) ||
    !ts.isStringLiteral(importDeclaration.moduleSpecifier)
  ) {
    emitDiagnostic(
      state,
      "TSN5203",
      "Cannot resolve namespace import declaration"
    );
    return unknownType;
  }

  const moduleSymbol = state.checker.getSymbolAtLocation(
    importDeclaration.moduleSpecifier
  );
  if (!moduleSymbol) {
    emitDiagnostic(
      state,
      "TSN5203",
      `Cannot resolve namespace import '${importDeclaration.moduleSpecifier.text}'`
    );
    return unknownType;
  }

  return buildModuleNamespaceTypeFromSymbol(state, moduleSymbol, new Set());
};

const getTypeQuerySegments = (exprName: ts.EntityName): readonly string[] => {
  if (ts.isIdentifier(exprName)) {
    return [exprName.text];
  }

  return [...getTypeQuerySegments(exprName.left), exprName.right.text];
};

const buildTypeQueryValueType = (
  state: TypeSystemState,
  exprName: ts.EntityName
): IrType => {
  const [rootName, ...memberNames] = getTypeQuerySegments(exprName);
  if (!rootName) {
    return unknownType;
  }

  const rootDeclId = state.resolveIdentifier(rootName);
  if (!rootDeclId) {
    emitDiagnostic(
      state,
      "TSN5203",
      `Cannot resolve type query root '${rootName}'`
    );
    return unknownType;
  }

  let currentType = typeOfValueRead(state, rootDeclId);
  for (const memberName of memberNames) {
    const members = getMembersFromType(currentType);
    const member = members?.find((candidate) => candidate.name === memberName);
    if (!member) {
      emitDiagnostic(
        state,
        "TSN5203",
        `Cannot resolve type query member '${memberName}'`
      );
      return unknownType;
    }
    currentType = memberValueType(member);
  }

  return currentType;
};

const buildSourceFileModuleNamespaceType = (
  state: TypeSystemState,
  sourceFile: ts.SourceFile
): IrType => {
  const directSymbol = state.checker.getSymbolAtLocation(sourceFile);
  const sourceFileWithSymbol = sourceFile as ts.SourceFile & {
    readonly symbol?: ts.Symbol;
  };
  const moduleSymbol = directSymbol ?? sourceFileWithSymbol.symbol;

  if (!moduleSymbol) {
    emitDiagnostic(
      state,
      "TSN5203",
      `Cannot resolve external module namespace for '${sourceFile.fileName}'`
    );
    return unknownType;
  }

  return buildModuleNamespaceTypeFromSymbol(state, moduleSymbol, new Set());
};

const getDeclarationTypeParameterArity = (
  declaration: ts.Declaration | undefined
): number | undefined => {
  if (!declaration) {
    return undefined;
  }

  if (
    ts.isClassDeclaration(declaration) ||
    ts.isInterfaceDeclaration(declaration) ||
    ts.isTypeAliasDeclaration(declaration) ||
    ts.isFunctionDeclaration(declaration) ||
    ts.isMethodDeclaration(declaration)
  ) {
    return declaration.typeParameters?.length;
  }

  return undefined;
};

const buildNominalReferenceType = (
  state: TypeSystemState,
  declInfo: NonNullable<
    ReturnType<TypeSystemState["handleRegistry"]["getDecl"]>
  >,
  declaration: ts.Declaration | undefined
): IrReferenceType => {
  const namedDeclaration = declaration as ts.NamedDeclaration | undefined;
  const simpleName =
    namedDeclaration?.name && ts.isIdentifier(namedDeclaration.name)
      ? namedDeclaration.name.text
      : undefined;
  const arity = getDeclarationTypeParameterArity(declaration);
  const typeId =
    (declInfo.fqName
      ? resolveTypeIdByName(state, declInfo.fqName, arity)
      : undefined) ??
    (simpleName ? resolveTypeIdByName(state, simpleName, arity) : undefined);

  return {
    kind: "referenceType",
    name: declInfo.fqName ?? simpleName ?? "unknown",
    ...(typeId ? { typeId, resolvedClrType: typeId.clrName } : {}),
  };
};

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
    effectiveDeclNode &&
    ts.isSourceFile(effectiveDeclNode) &&
    ts.isExternalModule(effectiveDeclNode)
  ) {
    result = buildSourceFileModuleNamespaceType(state, effectiveDeclNode);
  } else if (effectiveDeclNode && ts.isNamespaceImport(effectiveDeclNode)) {
    result = buildNamespaceImportType(state, effectiveDeclNode);
  } else if (
    effectiveFunctionValueDecl &&
    (ts.isFunctionDeclaration(effectiveFunctionValueDecl) ||
      ts.isMethodDeclaration(effectiveFunctionValueDecl) ||
      ts.isFunctionExpression(effectiveFunctionValueDecl) ||
      ts.isArrowFunction(effectiveFunctionValueDecl))
  ) {
    if (
      (ts.isFunctionDeclaration(effectiveFunctionValueDecl) ||
        ts.isMethodDeclaration(effectiveFunctionValueDecl)) &&
      (isOverloadSurfaceDeclaration(effectiveFunctionValueDecl) ||
        isOverloadStubImplementation(effectiveFunctionValueDecl))
    ) {
      const overloadSurfaceFamily = getOverloadSurfaceFamily(
        effectiveFunctionValueDecl
      );
      if (overloadSurfaceFamily && overloadSurfaceFamily.length > 0) {
        result = buildCallableOverloadFamilyType(
          overloadSurfaceFamily.map((member) =>
            buildFunctionTypeFromSignatureDeclaration(state, member)
          )
        );
        state.declTypeCache.set(declId.id, result);
        return result;
      }
    }

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
  } else if (effectiveTypeNode && ts.isTypeQueryNode(effectiveTypeNode)) {
    result = buildTypeQueryValueType(state, effectiveTypeNode.exprName);
  } else if (effectiveTypeNode) {
    // Explicit type annotation - convert to IR
    result = convertTypeNode(state, effectiveTypeNode);
  } else if (
    effectiveKind === "class" ||
    effectiveKind === "interface" ||
    effectiveKind === "enum"
  ) {
    // Class/interface/enum - return reference type
    result = buildNominalReferenceType(state, declInfo, effectiveDeclNode);
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
    } else if (isCatchVariableDeclaration(effectiveDeclNode)) {
      result = CATCH_VARIABLE_EXCEPTION_TYPE;
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
    if (isCatchVariableDeclaration(effectiveDeclNode)) {
      result = CATCH_VARIABLE_EXCEPTION_TYPE;
      state.declTypeCache.set(declId.id, result);
      return result;
    }
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
