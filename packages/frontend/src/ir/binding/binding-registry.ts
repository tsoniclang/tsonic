/**
 * Binding Layer — Registry Management & Simple Resolution
 *
 * Contains the BindingContext type, registry creation, and simple resolution
 * methods (identifiers, type references, property access, element access).
 * Complex call/constructor resolution lives in binding-call-resolution.ts.
 */

import type {
  TstsNode,
  TstsSourceFile,
  TstsSignature,
  TstsSymbol,
  ExtensionModuleGraph,
} from "@tsonic/tsts";
import {
  getTstsContainingSourceFile,
  getTstsIdentifierText,
  getTstsDeclaredTypeNode,
  getTstsDeclarationKind,
  getTstsNodeNameText,
  isTstsClassDeclaration,
  isTstsInterfaceDeclaration,
  isTstsFunctionLikeDeclaration,
  getTstsTypeParameterNodes,
  TstsSyntax,
} from "@tsonic/tsts";
import {
  DeclId,
  SignatureId,
  MemberId,
  makeDeclId,
  makeSignatureId,
  makeMemberId,
} from "../type-system/types.js";
import {
  getSourceBindingAliasFromDeclaration,
  isSourceBindingMarkerName,
} from "../type-system/internal/source-binding-markers.js";
import type {
  DeclEntry,
  SignatureEntry,
  MemberEntry,
  TypeSyntaxEntry,
} from "./binding-types.js";
import type { TypeParameterNode } from "../type-system/internal/handle-types.js";
import {
  extractThisParameterTypeNode,
  extractParameterNodes,
  extractTypeParameterNodes,
  extractTypePredicate,
  extractDeclaringIdentity,
  normalizeCapturedDeclaringTypeName,
  extractClassMemberNames,
  isOptionalMember,
  isReadonlyMember,
} from "./binding-helpers.js";
import type { TstsFrontendSourceSemanticView } from "../../source-frontend/index.js";
import type { ExternalBindingsResolver } from "../../resolver/external-bindings-resolver.js";

// ═══════════════════════════════════════════════════════════════════════════
// BINDING CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Shared mutable context for the binding factory closure.
 *
 * This holds the internal registries, counters, and caches that are shared
 * across all binding resolution methods. Created once by createBindingContext()
 * and threaded through all sub-module functions.
 */
export type BindingContext = {
  readonly sourceSemantics: TstsFrontendSourceSemanticView;
  readonly moduleGraph?: ExtensionModuleGraph;
  readonly externalResolver?: ExternalBindingsResolver;
  readonly sourceFilesByPath: ReadonlyMap<string, TstsSourceFile>;
  readonly dependencyEdgesByFromAndSpecifier: ReadonlyMap<string, string>;
  readonly declMap: Map<number, DeclEntry>;
  readonly signatureMap: Map<number, SignatureEntry>;
  readonly memberMap: Map<string, MemberEntry>;
  readonly typeSyntaxMap: Map<number, TypeSyntaxEntry>;
  readonly nextDeclId: { value: number };
  readonly nextSignatureId: { value: number };
  readonly nextTypeSyntaxId: { value: number };
  readonly symbolToDeclId: Map<TstsSymbol, DeclId>;
  readonly signatureToId: Map<TstsSignature, SignatureId>;
  readonly declarationToSignatureId: Map<TstsNode, SignatureId>;
  readonly syntheticSignatureNodeToId: Map<TstsNode, SignatureId>;
};

export type BindingModuleGraphInput = {
  readonly moduleGraph?: ExtensionModuleGraph;
  readonly externalResolver?: ExternalBindingsResolver;
  readonly sourceFiles?: readonly TstsSourceFile[];
  readonly dependencyEdges?: readonly {
    readonly from: string;
    readonly to: string;
    readonly specifier: string;
  }[];
};

const normalizeSourcePath = (fileName: string): string =>
  fileName.replace(/\\/g, "/");

const sourceFileNameOf = (sourceFile: TstsNode): string | undefined => {
  const maybeSourceFile = sourceFile as {
    readonly FileName?: () => string;
  };
  return maybeSourceFile.FileName?.();
};

const buildSourceFilesByPath = (
  sourceFiles: readonly TstsSourceFile[] | undefined
): ReadonlyMap<string, TstsSourceFile> => {
  const byPath = new Map<string, TstsSourceFile>();
  for (const sourceFile of sourceFiles ?? []) {
    const fileName = sourceFileNameOf(sourceFile);
    if (fileName) {
      byPath.set(normalizeSourcePath(fileName), sourceFile);
    }
  }
  return byPath;
};

const edgeKey = (from: string, specifier: string): string =>
  `${normalizeSourcePath(from)}\0${specifier}`;

const buildDependencyEdgesByFromAndSpecifier = (
  dependencyEdges:
    | readonly {
        readonly from: string;
        readonly to: string;
        readonly specifier: string;
      }[]
    | undefined
): ReadonlyMap<string, string> => {
  const byEdge = new Map<string, string>();
  for (const edge of dependencyEdges ?? []) {
    byEdge.set(edgeKey(edge.from, edge.specifier), normalizeSourcePath(edge.to));
  }
  return byEdge;
};

/**
 * Create a fresh BindingContext for a TSTS-backed source program.
 */
export const createBindingContext = (
  sourceSemantics: TstsFrontendSourceSemanticView,
  moduleGraphInput: BindingModuleGraphInput = {}
): BindingContext => ({
  sourceSemantics,
  moduleGraph: moduleGraphInput.moduleGraph,
  externalResolver: moduleGraphInput.externalResolver,
  sourceFilesByPath: buildSourceFilesByPath(moduleGraphInput.sourceFiles),
  dependencyEdgesByFromAndSpecifier: buildDependencyEdgesByFromAndSpecifier(
    moduleGraphInput.dependencyEdges
  ),
  declMap: new Map<number, DeclEntry>(),
  signatureMap: new Map<number, SignatureEntry>(),
  memberMap: new Map<string, MemberEntry>(),
  typeSyntaxMap: new Map<number, TypeSyntaxEntry>(),
  nextDeclId: { value: 0 },
  nextSignatureId: { value: 0 },
  nextTypeSyntaxId: { value: 0 },
  symbolToDeclId: new Map<TstsSymbol, DeclId>(),
  signatureToId: new Map<TstsSignature, SignatureId>(),
  declarationToSignatureId: new Map<TstsNode, SignatureId>(),
  syntheticSignatureNodeToId: new Map<TstsNode, SignatureId>(),
});

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export const isSyntheticBindingMarkerName = isSourceBindingMarkerName;

export const getBindingAliasFromDeclaration =
  getSourceBindingAliasFromDeclaration;

// ═══════════════════════════════════════════════════════════════════════════
// REGISTRY CREATION (getOrCreate*)
// ═══════════════════════════════════════════════════════════════════════════

export const getOrCreateDeclId = (
  ctx: BindingContext,
  symbol: TstsSymbol
): DeclId => {
  const existing = ctx.symbolToDeclId.get(symbol);
  if (existing) return existing;

  const id = makeDeclId(ctx.nextDeclId.value++);
  ctx.symbolToDeclId.set(symbol, id);

  // Get declaration info.
  //
  // IMPORTANT:
  // Some symbols (notably tsbindgen facades) intentionally merge a value export
  // and a type export under the same name, e.g.:
  //   export const ExternalAsync: typeof Internal.ExternalAsync;
  //   export type ExternalAsync<T1 = __> = ... Internal.ExternalAsync_1<T1> ...
  //
  // For expression identifiers we want the value declaration, while for type
  // references we must be able to access the type declaration. We capture both.
  const decls = ctx.sourceSemantics.getSymbolDeclarations(symbol);

  const valueDecl = decls.find((declNode) =>
    ["variable", "function", "parameter", "property", "method"].includes(
      getTstsDeclarationKind(declNode)
    )
  );

  const typeDecl = decls.find((declNode) =>
    ["typeAlias", "interface", "class", "enum"].includes(
      getTstsDeclarationKind(declNode)
    )
  );

  const decl = valueDecl ?? typeDecl ?? decls[0];

  // Capture class member names for override detection (TS-version safe)
  const classMemberNames =
    decl && isTstsClassDeclaration(decl)
      ? extractClassMemberNames(decl)
      : undefined;

  const entry: DeclEntry = {
    symbol,
    decl,
    typeDeclNode: typeDecl,
    valueDeclNode: valueDecl,
    typeNode: decl ? getTstsDeclaredTypeNode(decl) : undefined,
    kind: decl ? getTstsDeclarationKind(decl) : "variable",
    fqName:
      typeDecl &&
      (getTstsDeclarationKind(typeDecl) === "typeAlias" ||
        getTstsDeclarationKind(typeDecl) === "interface" ||
        getTstsDeclarationKind(typeDecl) === "class")
        ? (getBindingAliasFromDeclaration(typeDecl) ?? symbol.Name)
        : symbol.Name,
    classMemberNames,
  };
  ctx.declMap.set(id.id, entry);

  return id;
};

export const getOrCreateSyntheticDeclId = (
  ctx: BindingContext,
  declaration: TstsNode,
  name: string
): DeclId => {
  const id = makeDeclId(ctx.nextDeclId.value++);
  const kind = getTstsDeclarationKind(declaration);
  ctx.declMap.set(id.id, {
    decl: declaration,
    valueDeclNode: declaration,
    typeDeclNode: ["typeAlias", "interface", "class", "enum"].includes(kind)
      ? declaration
      : undefined,
    typeNode: getTstsDeclaredTypeNode(declaration),
    kind,
    fqName: name,
    classMemberNames: isTstsClassDeclaration(declaration)
      ? extractClassMemberNames(declaration)
      : undefined,
  });
  return id;
};

const concreteTstsNodes = (
  nodes: readonly (TstsNode | undefined)[]
): readonly TstsNode[] =>
  nodes.filter((node): node is TstsNode => node !== undefined);

const resolveDeclarationSymbolFQName = (
  ctx: BindingContext,
  symbol: TstsSymbol | undefined
): string | undefined => {
  if (!symbol) return undefined;
  const resolved = resolveTransparentAliases(ctx, symbol);
  const declId = getOrCreateDeclId(ctx, resolved);
  return ctx.declMap.get(declId.id)?.fqName;
};

export const resolveCanonicalDeclaringTypeName = (
  ctx: BindingContext,
  decl: TstsNode | undefined
): string | undefined => {
  const parent = decl?.Parent;
  if (!parent) return undefined;
  if (!isTstsInterfaceDeclaration(parent) && !isTstsClassDeclaration(parent)) {
    return undefined;
  }
  const parentName = getTstsNodeNameText(parent);
  const resolvedName =
    resolveDeclarationSymbolFQName(ctx, ctx.sourceSemantics.getSymbol(parent)) ??
    parentName;
  return resolvedName
    ? normalizeCapturedDeclaringTypeName(resolvedName)
    : undefined;
};

export const getOrCreateSignatureId = (
  ctx: BindingContext,
  signature: TstsSignature
): SignatureId => {
  const existing = ctx.signatureToId.get(signature);
  if (existing) return existing;

  const id = makeSignatureId(ctx.nextSignatureId.value++);
  ctx.signatureToId.set(signature, id);

  // Extract signature info from declaration
  const decl = ctx.sourceSemantics.getSignatureDeclaration(signature);

  // Extract declaring identity so resolveCall can apply inheritance substitution.
  const declaringIdentity = extractDeclaringIdentity(decl);
  const declaringTypeParameterNames = (() => {
    if (!decl) return undefined;
    const parent = decl.Parent;
    if (isTstsInterfaceDeclaration(parent) || isTstsClassDeclaration(parent)) {
      const parameters = concreteTstsNodes(getTstsTypeParameterNodes(parent))
        .map(getTstsNodeNameText)
        .filter((name): name is string => name !== undefined);
      return parameters.length > 0 ? parameters : undefined;
    }
    return undefined;
  })();

  // Extract type predicate from return type using syntax inspection only.
  const returnTypeNode = getTstsDeclaredTypeNode(decl);
  const typePredicate = extractTypePredicate(returnTypeNode, decl);
  const parameters = extractParameterNodes(decl, ctx.sourceSemantics);

  const entry: SignatureEntry = {
    signature,
    decl,
    parameters,
    thisTypeNode: extractThisParameterTypeNode(decl, ctx.sourceSemantics),
    returnTypeNode,
    typeParameters: extractTypeParameterNodes(decl),
    declaringTypeTsName:
      resolveCanonicalDeclaringTypeName(ctx, decl) ??
      declaringIdentity?.typeTsName,
    declaringTypeParameterNames,
    declaringMemberName: declaringIdentity?.memberName,
    typePredicate,
  };
  ctx.signatureMap.set(id.id, entry);

  return id;
};

export const getOrCreateSignatureIdFromDeclaration = (
  ctx: BindingContext,
  declaration: TstsNode
): SignatureId | undefined => {
  if (!isTstsFunctionLikeDeclaration(declaration)) {
    return undefined;
  }

  const existing = ctx.declarationToSignatureId.get(declaration);
  if (existing) {
    return existing;
  }

  const id = makeSignatureId(ctx.nextSignatureId.value++);
  ctx.declarationToSignatureId.set(declaration, id);
  const declaringIdentity = extractDeclaringIdentity(declaration);
  const parent = declaration.Parent;
  const declaringTypeParameterNames =
    isTstsInterfaceDeclaration(parent) || isTstsClassDeclaration(parent)
      ? concreteTstsNodes(getTstsTypeParameterNodes(parent))
          .map(getTstsNodeNameText)
          .filter((name): name is string => name !== undefined)
      : undefined;

  ctx.signatureMap.set(id.id, {
    signature: {} as TstsSignature,
    decl: declaration,
    parameters: extractParameterNodes(declaration, ctx.sourceSemantics),
    thisTypeNode: extractThisParameterTypeNode(
      declaration,
      ctx.sourceSemantics
    ),
    returnTypeNode: getTstsDeclaredTypeNode(declaration),
    typeParameters: extractTypeParameterNodes(declaration),
    declaringTypeTsName:
      resolveCanonicalDeclaringTypeName(ctx, declaration) ??
      declaringIdentity?.typeTsName,
    declaringTypeParameterNames:
      declaringTypeParameterNames && declaringTypeParameterNames.length > 0
        ? declaringTypeParameterNames
        : undefined,
    declaringMemberName: declaringIdentity?.memberName,
    typePredicate: extractTypePredicate(
      getTstsDeclaredTypeNode(declaration),
      declaration
    ),
  });

  return id;
};

export const getOrCreateSyntheticConstructorSignatureId = (
  ctx: BindingContext,
  node: TstsNode,
  declaringTypeTsName: string,
  typeParameters?: readonly TypeParameterNode[],
  declaringTypeParameterNames?: readonly string[]
): SignatureId => {
  const existing = ctx.syntheticSignatureNodeToId.get(node);
  if (existing) return existing;

  const id = makeSignatureId(ctx.nextSignatureId.value++);
  ctx.syntheticSignatureNodeToId.set(node, id);
  ctx.signatureMap.set(id.id, {
    signature: {} as TstsSignature,
    parameters: [],
    declaringTypeTsName,
    declaringTypeParameterNames:
      declaringTypeParameterNames && declaringTypeParameterNames.length > 0
        ? declaringTypeParameterNames
        : undefined,
    declaringMemberName: "constructor",
    typeParameters,
  });
  return id;
};

const exportDeclarationNode = (node: TstsNode): TstsNode => {
  if (TstsSyntax.IsVariableStatement(node)) {
    const declaration = TstsSyntax.AsVariableDeclarationList(
      TstsSyntax.AsVariableStatement(node)?.DeclarationList
    )?.Declarations?.Nodes[0];
    return declaration ?? node;
  }
  return node;
};

export const resolveExportedDeclaration = (
  ctx: BindingContext,
  sourceFile: TstsSourceFile,
  exportedName: string,
  seen: ReadonlySet<string> = new Set()
): TstsNode | undefined => {
  const module = ctx.moduleGraph?.getSourceFileModule(sourceFile);
  if (!module) {
    return undefined;
  }

  const sourceFileName = sourceFileNameOf(sourceFile);
  const seenKey = `${sourceFileName ?? ""}\0${exportedName}`;
  if (seen.has(seenKey)) {
    return undefined;
  }
  const nextSeen = new Set([...seen, seenKey]);

  for (const exportBinding of module.exports) {
    if (
      exportBinding.kind !== "named" &&
      exportBinding.kind !== "default" &&
      exportBinding.kind !== "namespace"
    ) {
      continue;
    }
    if (exportBinding.exportedName !== exportedName) {
      continue;
    }

    if (exportBinding.sourceSpecifier && sourceFileName) {
      const targetPath = ctx.dependencyEdgesByFromAndSpecifier.get(
        edgeKey(sourceFileName, exportBinding.sourceSpecifier)
      );
      const targetSourceFile = targetPath
        ? ctx.sourceFilesByPath.get(targetPath)
        : undefined;
      const targetName = exportBinding.localName ?? exportedName;
      return targetSourceFile
        ? resolveExportedDeclaration(
            ctx,
            targetSourceFile,
            targetName,
            nextSeen
          )
        : undefined;
    }

    return exportBinding.exportNode
      ? exportDeclarationNode(exportBinding.exportNode)
      : undefined;
  }

  return undefined;
};

export const resolveImportedDeclaration = (
  ctx: BindingContext,
  node: TstsNode
): TstsNode | undefined => {
  const localName = getTstsIdentifierText(node);
  if (!localName) {
    return undefined;
  }
  const sourceFile = getTstsContainingSourceFile(node);
  const sourceFileName = sourceFile ? sourceFileNameOf(sourceFile) : undefined;
  if (!sourceFile || !sourceFileName) {
    return undefined;
  }
  const sourceModule = ctx.moduleGraph?.getSourceFileModule(sourceFile);
  const importModule = sourceModule?.imports.find((candidate) =>
    candidate.bindings.some((binding) => binding.localName === localName)
  );
  const importBinding = importModule?.bindings.find(
    (binding) => binding.localName === localName
  );
  if (!importModule || !importBinding) {
    return undefined;
  }

  const targetPath = ctx.dependencyEdgesByFromAndSpecifier.get(
    edgeKey(sourceFileName, importModule.specifier)
  ) ?? (importModule.resolvedModule?.resolvedFileName
    ? normalizeSourcePath(importModule.resolvedModule.resolvedFileName)
    : undefined);
  const targetSourceFile = targetPath
    ? ctx.sourceFilesByPath.get(targetPath)
    : undefined;
  if (!targetSourceFile) {
    return undefined;
  }

  return resolveExportedDeclaration(
    ctx,
    targetSourceFile,
    importBinding.importedName
  );
};

export const getOrCreateMemberId = (
  ctx: BindingContext,
  ownerDeclId: DeclId,
  memberName: string,
  memberSymbol: TstsSymbol
): MemberId => {
  const key = `${ownerDeclId.id}:${memberName}`;
  const existing = ctx.memberMap.get(key);
  if (existing) return existing.memberId;

  const id = makeMemberId(ownerDeclId, memberName);
  const decl = ctx.sourceSemantics.getSymbolDeclarations(memberSymbol)[0];
  const entry: MemberEntry = {
    memberId: id,
    symbol: memberSymbol,
    decl,
    name: memberName,
    typeNode: decl ? getTstsDeclaredTypeNode(decl) : undefined,
    isOptional: isOptionalMember(memberSymbol),
    isReadonly: isReadonlyMember(decl),
  };
  ctx.memberMap.set(key, entry);

  return id;
};

// ═══════════════════════════════════════════════════════════════════════════
// SIMPLE RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

export const resolveTransparentAliases = (
  ctx: BindingContext,
  input: TstsSymbol
): TstsSymbol => {
  const seen = new Set<TstsSymbol>();
  let current = input;

  while (!seen.has(current)) {
    seen.add(current);

    const aliased = ctx.sourceSemantics.resolveAlias(current);
    if (aliased !== undefined && aliased !== current) {
      current = aliased;
      continue;
    }

    const [declaration] = ctx.sourceSemantics.getSymbolDeclarations(current);
    const targetSymbol =
      declaration && TstsSyntax.IsExportSpecifier(declaration)
        ? ctx.sourceSemantics.getExportSpecifierLocalTargetSymbol(declaration)
        : undefined;
    if (!targetSymbol || targetSymbol === current) {
      break;
    }

    current = targetSymbol;
  }

  return current;
};

export const resolveIdentifier = (
  ctx: BindingContext,
  node: TstsNode
): DeclId | undefined => {
  const symbol = ctx.sourceSemantics.getSymbol(node);
  if (!symbol) {
    const importedDeclaration = resolveImportedDeclaration(ctx, node);
    const importedName = getTstsNodeNameText(importedDeclaration);
    return importedDeclaration && importedName
      ? getOrCreateSyntheticDeclId(ctx, importedDeclaration, importedName)
      : undefined;
  }

  const resolvedSymbol = resolveTransparentAliases(ctx, symbol);
  const symbolDeclarations = ctx.sourceSemantics.getSymbolDeclarations(
    resolvedSymbol
  );
  const isImportBindingSymbol =
    symbolDeclarations.length > 0 &&
    symbolDeclarations.every(
      (declaration) =>
        TstsSyntax.IsImportSpecifier(declaration) ||
        TstsSyntax.IsImportClause(declaration) ||
        TstsSyntax.IsNamespaceImport(declaration)
    );

  if (isImportBindingSymbol) {
    const importedDeclaration = resolveImportedDeclaration(ctx, node);
    const importedName = getTstsNodeNameText(importedDeclaration);
    if (importedDeclaration && importedName) {
      return getOrCreateSyntheticDeclId(ctx, importedDeclaration, importedName);
    }
  }

  const declId = getOrCreateDeclId(ctx, resolvedSymbol);
  const entry = ctx.declMap.get(declId.id);
  if (entry?.decl) {
    return declId;
  }

  const importedDeclaration = resolveImportedDeclaration(ctx, node);
  const importedName = getTstsNodeNameText(importedDeclaration);
  return importedDeclaration && importedName
    ? getOrCreateSyntheticDeclId(ctx, importedDeclaration, importedName)
    : declId;
};

export const resolveTypeReference = (
  ctx: BindingContext,
  node: TstsNode
): DeclId | undefined => {
  const typeReference = TstsSyntax.AsTypeReferenceNode(node);
  const lookupNode = typeReference?.TypeName ?? node;
  const importedDeclaration = resolveImportedDeclaration(ctx, lookupNode);
  const importedName = getTstsNodeNameText(importedDeclaration);
  if (importedDeclaration && importedName) {
    return getOrCreateSyntheticDeclId(
      ctx,
      importedDeclaration,
      importedName
    );
  }

  const symbol = ctx.sourceSemantics.getSymbol(lookupNode);
  if (!symbol) return undefined;
  return getOrCreateDeclId(ctx, resolveTransparentAliases(ctx, symbol));
};

const getMemberOwnerDeclId = (
  ctx: BindingContext,
  expression: TstsNode | undefined,
  declaringSymbol: TstsSymbol
): DeclId => {
  const ownerType =
    expression === undefined ? undefined : ctx.sourceSemantics.getExpressionType(expression);
  const ownerSymbol =
    ownerType === undefined
      ? undefined
      : ctx.sourceSemantics.getTypeAliasOrSymbol(ownerType);
  return getOrCreateDeclId(
    ctx,
    ownerSymbol ? resolveTransparentAliases(ctx, ownerSymbol) : declaringSymbol
  );
};

export const resolvePropertyAccess = (
  ctx: BindingContext,
  node: TstsNode
): MemberId | undefined => {
  const nameNode = TstsSyntax.Node_Name(node);
  const rawPropSymbol = ctx.sourceSemantics.getSymbol(nameNode ?? node);
  if (!rawPropSymbol) return undefined;

  const propSymbol = resolveTransparentAliases(ctx, rawPropSymbol);
  const ownerDeclId = getMemberOwnerDeclId(
    ctx,
    TstsSyntax.Node_Expression(node),
    propSymbol
  );
  return getOrCreateMemberId(ctx, ownerDeclId, propSymbol.Name, propSymbol);
};

export const resolveElementAccess = (
  ctx: BindingContext,
  node: TstsNode
): MemberId | undefined => {
  const memberSymbol = ctx.sourceSemantics.getSymbol(node);
  if (!memberSymbol) return undefined;
  const resolved = resolveTransparentAliases(ctx, memberSymbol);
  const ownerDeclId = getMemberOwnerDeclId(
    ctx,
    TstsSyntax.Node_Expression(node),
    resolved
  );
  return getOrCreateMemberId(ctx, ownerDeclId, resolved.Name, resolved);
};
