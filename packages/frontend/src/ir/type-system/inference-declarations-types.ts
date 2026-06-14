/**
 * Declaration type queries — typeOfDecl, typeOfValueRead, getFQNameOfDecl,
 * hasTypeParameters, isTypeDecl, isInterfaceDecl, isTypeAliasToObjectLiteral,
 * declHasTypeAnnotation.
 *
 * DAG position: depends on inference-utilities, inference-initializers,
 *               type-system-state
 */

import type { TstsNode, TstsSymbol } from "@tsonic/tsts";
import {
  getTstsDeclaredTypeNode,
  getTstsIdentifierText,
  getTstsMemberNodes,
  getTstsNodeNameText,
  getTstsNodeText,
  getTstsParameters,
  getTstsStatementNodes,
  getTstsTypeParameterNodes,
  hasTstsStaticModifier,
  isTstsOptionalParameter,
  isTstsRestParameter,
  TstsSyntax,
} from "@tsonic/tsts";
import type {
  IrType,
  IrReferenceType,
  IrFunctionType,
  IrTypeParameter,
  IrInterfaceMember,
} from "../types/index.js";
import type { DeclId } from "./types.js";
import { unknownType } from "./types.js";
import type { TypeSystemState, DeclKind } from "./type-system-state.js";
import { emitDiagnostic } from "./type-system-state.js";
import { resolveTypeIdByName } from "./type-system-state.js";
import { convertTypeNode } from "./type-system-call-resolution.js";
import {
  buildCallableOverloadFamilyType,
  makeOptionalReadType,
} from "./inference-utilities.js";
import { tryInferTypeFromInitializer } from "./inference-initializers.js";
import {
  getMembersFromType,
  memberValueType,
} from "./internal/type-converter/type-operators.js";
import { extractNominalStructuralMembers } from "./inference-declarations-structural.js";
import {
  isOverloadStubImplementation,
  isOverloadSurfaceDeclaration,
} from "../syntax/overload-stubs.js";
import { tryResolveDeterministicPropertyName } from "../syntax/property-names.js";
import { typeIdProviderLookupName } from "./internal/universe/types.js";

const CATCH_VARIABLE_EXCEPTION_TYPE: IrReferenceType = {
  kind: "referenceType",
  name: "Error",
  providerQualifiedName: "core:Error",
};

const isTstsNode = (node: unknown): node is TstsNode =>
  typeof node === "object" && node !== null && "Kind" in node;

const asTstsNode = (node: unknown): TstsNode | undefined =>
  isTstsNode(node) ? node : undefined;

const concreteTstsNodes = (
  nodes: readonly (TstsNode | undefined)[]
): readonly TstsNode[] =>
  nodes.filter((node): node is TstsNode => node !== undefined);

const isCatchVariableDeclaration = (
  declaration: TstsNode | undefined
): boolean =>
  !!declaration &&
  TstsSyntax.IsVariableDeclaration(declaration) &&
  declaration.Parent?.Kind === TstsSyntax.KindCatchClause;

const convertSignatureTypeParameters = (
  state: TypeSystemState,
  declaration: TstsNode
): readonly IrTypeParameter[] | undefined => {
  const typeParameters = concreteTstsNodes(getTstsTypeParameterNodes(declaration));
  if (typeParameters.length === 0) {
    return undefined;
  }

  return typeParameters.map((typeParameter) => {
    const data = TstsSyntax.AsTypeParameterDeclaration(typeParameter);
    const constraint = data?.Constraint;
    const defaultType = data?.DefaultType;
    return {
      kind: "typeParameter",
      name: getTstsNodeNameText(typeParameter) ?? "T",
      constraint: constraint ? convertTypeNode(state, constraint) : undefined,
      default: defaultType ? convertTypeNode(state, defaultType) : undefined,
      variance: undefined,
      isStructuralConstraint: constraint?.Kind === TstsSyntax.KindTypeLiteral,
      structuralMembers: undefined,
    };
  });
};

const buildFunctionTypeFromSignatureDeclaration = (
  state: TypeSystemState,
  declaration: TstsNode
): IrFunctionType => ({
  kind: "functionType",
  typeParameters: convertSignatureTypeParameters(state, declaration),
  parameters: concreteTstsNodes(getTstsParameters(declaration)).map(
    (parameter, index) => ({
      kind: "parameter",
      pattern: {
        kind: "identifierPattern",
        name: getTstsNodeNameText(parameter) ?? `p${index}`,
      },
      type: getTstsDeclaredTypeNode(parameter)
        ? convertTypeNode(state, getTstsDeclaredTypeNode(parameter))
        : unknownType,
      initializer: undefined,
      isOptional: isTstsOptionalParameter(parameter),
      isRest: isTstsRestParameter(parameter),
      passing: "value",
    })
  ),
  returnType: getTstsDeclaredTypeNode(declaration)
    ? convertTypeNode(state, getTstsDeclaredTypeNode(declaration))
    : unknownType,
});

const getOverloadSurfaceFamily = (
  declaration: TstsNode
): readonly TstsNode[] | undefined => {
  const declarationName = getTstsNodeNameText(declaration);
  if (!declarationName) {
    return undefined;
  }

  if (TstsSyntax.IsFunctionDeclaration(declaration)) {
    const parent = declaration.Parent;
    if (!parent || parent.Kind !== TstsSyntax.KindSourceFile) {
      return undefined;
    }

    const family = concreteTstsNodes(getTstsStatementNodes(parent)).filter(
      (statement) =>
        TstsSyntax.IsFunctionDeclaration(statement) &&
        getTstsNodeNameText(statement) === declarationName
    );
    if (family.length === 0) {
      return undefined;
    }

    const overloadSurface = family.filter(isOverloadSurfaceDeclaration);
    return overloadSurface.length > 0 ? overloadSurface : undefined;
  }

  const parent = declaration.Parent;
  if (!parent || !TstsSyntax.IsClassDeclaration(parent)) {
    return undefined;
  }

  const methodName = tryResolveDeterministicPropertyName(
    TstsSyntax.Node_PropertyNameOrName(declaration)
  );
  if (!methodName) {
    return undefined;
  }
  const family = concreteTstsNodes(getTstsMemberNodes(parent)).filter(
    (member) =>
      TstsSyntax.IsMethodDeclaration(member) &&
      tryResolveDeterministicPropertyName(
        TstsSyntax.Node_PropertyNameOrName(member)
      ) === methodName &&
      hasTstsStaticModifier(member) === hasTstsStaticModifier(declaration)
  );
  if (family.length === 0) {
    return undefined;
  }

  const overloadSurface = family.filter(isOverloadSurfaceDeclaration);
  return overloadSurface.length > 0 ? overloadSurface : undefined;
};

const getNamedRuntimeDeclarationDeclId = (
  state: TypeSystemState,
  declaration: TstsNode
): DeclId | undefined => {
  if (
    TstsSyntax.IsFunctionDeclaration(declaration) ||
    TstsSyntax.IsClassDeclaration(declaration) ||
    TstsSyntax.IsEnumDeclaration(declaration)
  ) {
    const name = TstsSyntax.Node_Name(declaration);
    return name?.Kind === TstsSyntax.KindIdentifier
      ? state.resolveIdentifier(name)
      : undefined;
  }

  if (TstsSyntax.IsVariableDeclaration(declaration)) {
    const name = TstsSyntax.Node_Name(declaration);
    return name?.Kind === TstsSyntax.KindIdentifier
      ? state.resolveIdentifier(name)
      : undefined;
  }

  return undefined;
};

const buildModuleNamespaceTypeFromSymbol = (
  state: TypeSystemState,
  input: TstsSymbol,
  seen: Set<TstsSymbol>
): IrType => {
  const resolved = state.sourceSemantics.resolveAlias(input);
  if (!resolved) {
    return unknownType;
  }
  const moduleSymbol = resolved;

  if (seen.has(moduleSymbol)) {
    emitDiagnostic(
      state,
      "TSN5203",
      `Circular module namespace export surface is not supported deterministically`
    );
    return unknownType;
  }

  seen.add(moduleSymbol);

  const exportSymbols = state.sourceSemantics
    .getExportsOfModule(moduleSymbol)
    .filter((symbol): symbol is TstsSymbol => symbol !== undefined)
    .sort((left, right) => left.Name.localeCompare(right.Name));

  const members: IrInterfaceMember[] = [];

  for (const exportSymbol of exportSymbols) {
    const actualSymbol = state.sourceSemantics.resolveAlias(exportSymbol);
    if (!actualSymbol) continue;

    if ((actualSymbol.Flags & TstsSyntax.SymbolFlagsValue) === 0) {
      continue;
    }

    const memberType = (() => {
      if (
        actualSymbol.Flags &
        (TstsSyntax.SymbolFlagsValueModule |
          TstsSyntax.SymbolFlagsNamespaceModule)
      ) {
        return buildModuleNamespaceTypeFromSymbol(state, actualSymbol, seen);
      }

      for (const declaration of state.sourceSemantics.getSymbolDeclarations(
        actualSymbol
      )) {
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
        `Namespace import export '${exportSymbol.Name}' could not be represented deterministically`
      );
      return unknownType;
    }

    members.push({
      kind: "propertySignature",
      name: exportSymbol.Name,
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
  declaration: TstsNode
): IrType => {
  const importClause = declaration.Parent;
  const importDeclaration = importClause?.Parent;
  const moduleSpecifier = importDeclaration
    ? TstsSyntax.Node_ModuleSpecifier(importDeclaration)
    : undefined;

  if (
    !importClause ||
    importClause.Kind !== TstsSyntax.KindImportClause ||
    !importDeclaration ||
    moduleSpecifier?.Kind !== TstsSyntax.KindStringLiteral
  ) {
    emitDiagnostic(
      state,
      "TSN5203",
      "Cannot resolve namespace import declaration"
    );
    return unknownType;
  }

  const moduleSymbol = state.sourceSemantics.getSymbol(moduleSpecifier);
  if (!moduleSymbol) {
    emitDiagnostic(
      state,
      "TSN5203",
      `Cannot resolve namespace import '${getTstsNodeText(moduleSpecifier) ?? ""}'`
    );
    return unknownType;
  }

  return buildModuleNamespaceTypeFromSymbol(state, moduleSymbol, new Set());
};

const getTypeQuerySegments = (exprName: TstsNode): readonly string[] => {
  if (TstsSyntax.IsIdentifier(exprName)) {
    return [getTstsIdentifierText(exprName) ?? ""].filter(
      (segment) => segment.length > 0
    );
  }

  if (TstsSyntax.IsQualifiedName(exprName)) {
    const qualified = TstsSyntax.AsQualifiedName(exprName);
    const right = qualified?.Right
      ? getTstsIdentifierText(qualified.Right)
      : undefined;
    return qualified?.Left && right
      ? [...getTypeQuerySegments(qualified.Left), right]
      : [];
  }

  return [];
};

const buildTypeQueryValueType = (
  state: TypeSystemState,
  exprName: TstsNode
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
  sourceFile: TstsNode
): IrType => {
  const moduleSymbol =
    state.sourceSemantics.getSymbol(sourceFile) ??
    TstsSyntax.Node_Symbol(sourceFile);

  if (!moduleSymbol) {
    emitDiagnostic(
      state,
      "TSN5203",
      `Cannot resolve external module namespace`
    );
    return unknownType;
  }

  return buildModuleNamespaceTypeFromSymbol(state, moduleSymbol, new Set());
};

const getDeclarationTypeParameterArity = (
  declaration: TstsNode | undefined
): number | undefined => {
  if (!declaration) {
    return undefined;
  }

  if (
    TstsSyntax.IsClassDeclaration(declaration) ||
    TstsSyntax.IsInterfaceDeclaration(declaration) ||
    TstsSyntax.IsTypeAliasDeclaration(declaration) ||
    TstsSyntax.IsFunctionDeclaration(declaration) ||
    TstsSyntax.IsMethodDeclaration(declaration)
  ) {
    return getTstsTypeParameterNodes(declaration).length;
  }

  return undefined;
};

const buildNominalReferenceType = (
  state: TypeSystemState,
  declInfo: NonNullable<
    ReturnType<TypeSystemState["handleRegistry"]["getDecl"]>
  >,
  declaration: TstsNode | undefined
): IrReferenceType => {
  const simpleName = declaration ? getTstsNodeNameText(declaration) : undefined;
  const arity = getDeclarationTypeParameterArity(declaration);
  const typeId =
    (declInfo.fqName
      ? resolveTypeIdByName(state, declInfo.fqName, arity)
      : undefined) ??
    (simpleName ? resolveTypeIdByName(state, simpleName, arity) : undefined);
  const structuralMembers = extractNominalStructuralMembers(state, declaration);

  return {
    kind: "referenceType",
    name: declInfo.fqName ?? simpleName ?? "unknown",
    ...(typeId
      ? { typeId, providerQualifiedName: typeIdProviderLookupName(typeId) }
      : {}),
    ...(structuralMembers
      ? { structuralMembers, structuralOrigin: "namedReference" as const }
      : {}),
  };
};

// ─────────────────────────────────────────────────────────────────────────
// typeOfDecl — Get declared type of a declaration
// ─────────────────────────────────────────────────────────────────────────

export const typeOfDecl = (state: TypeSystemState, declId: DeclId): IrType => {
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
    asTstsNode(declInfo.valueDeclNode) ?? asTstsNode(declInfo.declNode);
  const initializer = effectiveValueDecl
    ? TstsSyntax.Node_Initializer(effectiveValueDecl)
    : undefined;
  const effectiveFunctionValueDecl =
    effectiveValueDecl &&
    TstsSyntax.IsVariableDeclaration(effectiveValueDecl) &&
    initializer &&
    (TstsSyntax.IsFunctionExpression(initializer) ||
      TstsSyntax.IsArrowFunction(initializer))
      ? initializer
      : effectiveValueDecl;
  const effectiveTypeDecl =
    asTstsNode(declInfo.typeDeclNode) ?? effectiveValueDecl;
  const effectiveDeclNode = effectiveValueDecl ?? effectiveTypeDecl;
  const effectiveTypeNode =
    asTstsNode(declInfo.typeNode) ??
    (effectiveDeclNode ? getTstsDeclaredTypeNode(effectiveDeclNode) : undefined);
  const hasExplicitVariableType =
    effectiveValueDecl &&
    TstsSyntax.IsVariableDeclaration(effectiveValueDecl) &&
    getTstsDeclaredTypeNode(effectiveValueDecl) !== undefined;
  const effectiveKind: DeclKind = (() => {
    const source = effectiveDeclNode;
    if (!source) return declInfo.kind;
    if (TstsSyntax.IsFunctionDeclaration(source)) return "function";
    if (TstsSyntax.IsVariableDeclaration(source)) return "variable";
    if (TstsSyntax.IsClassDeclaration(source)) return "class";
    if (TstsSyntax.IsInterfaceDeclaration(source)) return "interface";
    if (TstsSyntax.IsTypeAliasDeclaration(source)) return "typeAlias";
    if (TstsSyntax.IsEnumDeclaration(source)) return "enum";
    if (TstsSyntax.IsParameterDeclaration(source)) return "parameter";
    if (
      TstsSyntax.IsPropertyDeclaration(source) ||
      TstsSyntax.IsPropertySignatureDeclaration(source) ||
      TstsSyntax.IsGetAccessorDeclaration(source) ||
      TstsSyntax.IsSetAccessorDeclaration(source)
    ) {
      return "property";
    }
    if (
      TstsSyntax.IsMethodDeclaration(source) ||
      TstsSyntax.IsMethodSignatureDeclaration(source)
    ) {
      return "method";
    }
    return declInfo.kind;
  })();

  let result: IrType;

  if (effectiveDeclNode?.Kind === TstsSyntax.KindSourceFile) {
    result = buildSourceFileModuleNamespaceType(state, effectiveDeclNode);
  } else if (
    effectiveDeclNode &&
    TstsSyntax.IsNamespaceImport(effectiveDeclNode)
  ) {
    result = buildNamespaceImportType(state, effectiveDeclNode);
  } else if (
    !hasExplicitVariableType &&
    effectiveFunctionValueDecl &&
    (TstsSyntax.IsFunctionDeclaration(effectiveFunctionValueDecl) ||
      TstsSyntax.IsMethodDeclaration(effectiveFunctionValueDecl) ||
      TstsSyntax.IsFunctionExpression(effectiveFunctionValueDecl) ||
      TstsSyntax.IsArrowFunction(effectiveFunctionValueDecl))
  ) {
    if (
      (TstsSyntax.IsFunctionDeclaration(effectiveFunctionValueDecl) ||
        TstsSyntax.IsMethodDeclaration(effectiveFunctionValueDecl)) &&
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

    if (!getTstsDeclaredTypeNode(effectiveFunctionValueDecl)) {
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
  } else if (effectiveTypeNode && TstsSyntax.IsTypeQueryNode(effectiveTypeNode)) {
    const exprName = TstsSyntax.AsTypeQueryNode(effectiveTypeNode)?.ExprName;
    result = exprName ? buildTypeQueryValueType(state, exprName) : unknownType;
  } else if (effectiveTypeNode) {
    result = convertTypeNode(state, effectiveTypeNode);
  } else if (
    effectiveKind === "class" ||
    effectiveKind === "interface" ||
    effectiveKind === "enum"
  ) {
    result = buildNominalReferenceType(state, declInfo, effectiveDeclNode);
  } else if (effectiveKind === "function") {
    emitDiagnostic(
      state,
      "TSN5201",
      `Function '${declInfo.fqName ?? "unknown"}' requires explicit return type`
    );
    result = unknownType;
  } else if (effectiveKind === "variable" && effectiveDeclNode) {
    const inferred = tryInferTypeFromInitializer(state, effectiveDeclNode);
    if (inferred) {
      result = inferred;
    } else if (isCatchVariableDeclaration(effectiveDeclNode)) {
      result = CATCH_VARIABLE_EXCEPTION_TYPE;
    } else {
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
    asTstsNode(declInfo?.valueDeclNode) ?? asTstsNode(declInfo?.declNode);

  if (
    effectiveValueDecl &&
    ((TstsSyntax.IsParameterDeclaration(effectiveValueDecl) &&
      TstsSyntax.Node_QuestionToken(effectiveValueDecl) !== undefined) ||
      ((TstsSyntax.IsPropertyDeclaration(effectiveValueDecl) ||
        TstsSyntax.IsPropertySignatureDeclaration(effectiveValueDecl)) &&
        TstsSyntax.Node_QuestionToken(effectiveValueDecl) !== undefined))
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
  const declNode = asTstsNode(declInfo?.declNode);
  return declNode ? getTstsTypeParameterNodes(declNode).length > 0 : false;
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

  const declNode = asTstsNode(declInfo.declNode);
  const typeNode = declNode ? getTstsDeclaredTypeNode(declNode) : undefined;
  return typeNode?.Kind === TstsSyntax.KindTypeLiteral;
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
