import { readFileSync } from "node:fs";
import type { TstsNode, TstsSourceFile } from "@tsonic/tsts";
import {
  getTstsContainingSourceFile,
  getTstsIdentifierText,
  TstsSyntax,
} from "@tsonic/tsts";
import { extractRawExternalBindingTypes } from "../../program/external-binding-payload.js";
import { tsbindgenTargetTypeNameToTsTypeName } from "../../tsbindgen/names.js";
import type {
  BindingExternalImportTypeIdentity,
  BindingImportedSourceNamespaceMemberTarget,
  BindingImportedSourceValueTarget,
} from "./binding-types.js";
import {
  resolveExportedDeclaration,
  type BindingContext,
} from "./binding-registry.js";

type ExternalTypeAliasIndex = {
  readonly aliases: ReadonlyMap<string, BindingExternalImportTypeIdentity>;
  readonly ambiguousAliases: ReadonlySet<string>;
};

const externalTypeAliasIndexByBindingsPath = new Map<
  string,
  ExternalTypeAliasIndex
>();

const sourceFileNameOf = (
  sourceFile: TstsNode | TstsSourceFile | undefined
): string | undefined => {
  const maybeSourceFile = sourceFile as {
    readonly FileName?: () => string;
  };
  return maybeSourceFile.FileName?.();
};

const normalizeSourcePath = (fileName: string): string =>
  fileName.replace(/\\/g, "/");

const edgeKey = (from: string, specifier: string): string =>
  `${normalizeSourcePath(from)}\0${specifier}`;

const simpleAliasFromArityAlias = (alias: string): string | undefined => {
  const match = alias.match(/^(.+)_(\d+)$/);
  return match?.[1];
};

const addAlias = (
  aliases: Map<string, BindingExternalImportTypeIdentity>,
  ambiguousAliases: Set<string>,
  alias: string | undefined,
  identity: BindingExternalImportTypeIdentity
): void => {
  const normalized = alias?.trim();
  if (!normalized) return;

  const existing = aliases.get(normalized);
  if (!existing) {
    aliases.set(normalized, identity);
    return;
  }

  if (existing.providerQualifiedName !== identity.providerQualifiedName) {
    ambiguousAliases.add(normalized);
  }
};

const buildExternalTypeAliasIndex = (
  bindingsPath: string
): ExternalTypeAliasIndex => {
  const cached = externalTypeAliasIndexByBindingsPath.get(bindingsPath);
  if (cached) return cached;

  const aliases = new Map<string, BindingExternalImportTypeIdentity>();
  const ambiguousAliases = new Set<string>();
  const raw = JSON.parse(readFileSync(bindingsPath, "utf-8")) as unknown;
  const types = extractRawExternalBindingTypes(raw) ?? [];

  for (const type of types) {
    if (!type || typeof type !== "object") continue;
    const record = type as {
      readonly targetName?: unknown;
      readonly alias?: unknown;
    };
    if (
      typeof record.targetName !== "string" ||
      record.targetName.trim().length === 0
    ) {
      continue;
    }

    const targetName = record.targetName;
    const tsAlias = tsbindgenTargetTypeNameToTsTypeName(targetName);
    const explicitAlias =
      typeof record.alias === "string" && record.alias.trim().length > 0
        ? record.alias
        : undefined;
    const identity: BindingExternalImportTypeIdentity = {
      sourceName: explicitAlias ?? simpleAliasFromArityAlias(tsAlias) ?? tsAlias,
      providerQualifiedName: targetName,
    };

    addAlias(aliases, ambiguousAliases, tsAlias, identity);
    addAlias(aliases, ambiguousAliases, explicitAlias, identity);
    addAlias(
      aliases,
      ambiguousAliases,
      simpleAliasFromArityAlias(tsAlias),
      identity
    );
    addAlias(aliases, ambiguousAliases, targetName, identity);
  }

  const index = { aliases, ambiguousAliases };
  externalTypeAliasIndexByBindingsPath.set(bindingsPath, index);
  return index;
};

const rightmostEntityName = (node: TstsNode | undefined): string | undefined => {
  if (!node) return undefined;
  const identifier = getTstsIdentifierText(node);
  if (identifier) return identifier;
  const qualified = TstsSyntax.AsQualifiedName(node);
  return qualified?.Right ? rightmostEntityName(qualified.Right) : undefined;
};

const leftmostEntityName = (node: TstsNode | undefined): string | undefined => {
  if (!node) return undefined;
  const identifier = getTstsIdentifierText(node);
  if (identifier) return identifier;
  const qualified = TstsSyntax.AsQualifiedName(node);
  return qualified?.Left ? leftmostEntityName(qualified.Left) : undefined;
};

const getTypeReferenceName = (
  node: TstsNode
): { readonly localName: string; readonly importedName: string } | undefined => {
  const typeReference = TstsSyntax.AsTypeReferenceNode(node);
  const typeName = typeReference?.TypeName ?? node;
  const localName = leftmostEntityName(typeName);
  const importedName = rightmostEntityName(typeName);
  return localName && importedName ? { localName, importedName } : undefined;
};

export const resolveExternalImportType = (
  ctx: BindingContext,
  node: TstsNode
): BindingExternalImportTypeIdentity | undefined => {
  const names = getTypeReferenceName(node);
  if (!names) return undefined;

  const sourceFile = getTstsContainingSourceFile(node);
  const sourceFileName = sourceFile ? sourceFileNameOf(sourceFile) : undefined;
  if (!sourceFile || !sourceFileName) return undefined;

  const sourceModule = ctx.moduleGraph?.getSourceFileModule(sourceFile);
  const importModule = sourceModule?.imports.find((candidate) =>
    candidate.bindings.some((binding) => binding.localName === names.localName)
  );
  const importBinding = importModule?.bindings.find(
    (binding) => binding.localName === names.localName
  );
  if (!importModule || !importBinding) return undefined;

  const external = ctx.externalResolver?.resolve(importModule.specifier);
  if (!external || external.kind !== "externalSurface") {
    return undefined;
  }

  const importedName =
    importBinding.kind === "namespace"
      ? names.importedName
      : importBinding.importedName;
  const index = buildExternalTypeAliasIndex(external.bindingsPath);
  if (index.ambiguousAliases.has(importedName)) {
    throw new Error(
      `Ambiguous external type import '${importedName}' from '${importModule.specifier}' in '${sourceFileName}'.`
    );
  }

  return index.aliases.get(importedName);
};

export const resolveImportedSourceValue = (
  ctx: BindingContext,
  node: TstsNode
): BindingImportedSourceValueTarget | undefined => {
  const localName = getTstsIdentifierText(node);
  if (!localName) return undefined;

  const sourceFile = getTstsContainingSourceFile(node);
  const sourceFileName = sourceFile ? sourceFileNameOf(sourceFile) : undefined;
  if (!sourceFile || !sourceFileName) return undefined;

  const importBinding = ctx.moduleGraph?.getImportBinding(sourceFile, localName);
  if (
    !importBinding ||
    importBinding.kind !== "named" ||
    importBinding.isTypeOnly
  ) {
    return undefined;
  }

  const sourceModule = ctx.moduleGraph?.getSourceFileModule(sourceFile);
  const importModule = sourceModule?.imports.find((candidate) =>
    candidate.bindings.some((binding) => binding === importBinding)
  );
  if (!importModule) return undefined;

  const targetPath =
    importModule.resolvedModule?.resolvedFileName ??
    ctx.dependencyEdgesByFromAndSpecifier.get(
      edgeKey(sourceFileName, importModule.specifier)
    );
  if (!targetPath) return undefined;

  return {
    sourceFilePath: normalizeSourcePath(targetPath),
    exportName: importBinding.importedName,
  };
};

const resolveNamespaceImportSpecifier = (
  ctx: BindingContext,
  sourceFile: TstsSourceFile,
  namespaceName: string
): string | undefined => {
  const sourceModule = ctx.moduleGraph?.getSourceFileModule(sourceFile);
  const importModule = sourceModule?.imports.find((candidate) =>
    candidate.bindings.some(
      (binding) =>
        binding.kind === "namespace" && binding.localName === namespaceName
    )
  );
  return importModule?.specifier;
};

export const resolveImportedSourceNamespaceMember = (
  ctx: BindingContext,
  node: TstsNode
): BindingImportedSourceNamespaceMemberTarget | undefined => {
  if (!TstsSyntax.IsPropertyAccessExpression(node)) {
    return undefined;
  }

  const receiver = TstsSyntax.Node_Expression(node);
  const namespaceName = getTstsIdentifierText(receiver);
  const exportName = getTstsIdentifierText(TstsSyntax.Node_Name(node));
  if (!namespaceName || !exportName) {
    return undefined;
  }

  const sourceFile = getTstsContainingSourceFile(node);
  const sourceFileName = sourceFile ? sourceFileNameOf(sourceFile) : undefined;
  if (!sourceFile || !sourceFileName) {
    return undefined;
  }

  const importSpecifier = resolveNamespaceImportSpecifier(
    ctx,
    sourceFile,
    namespaceName
  );
  if (!importSpecifier) {
    return undefined;
  }

  const sourceModule = ctx.moduleGraph?.getSourceFileModule(sourceFile);
  const importModule = sourceModule?.imports.find(
    (candidate) => candidate.specifier === importSpecifier
  );
  const targetPath =
    ctx.dependencyEdgesByFromAndSpecifier.get(
      edgeKey(sourceFileName, importSpecifier)
    ) ??
    (importModule?.resolvedModule?.resolvedFileName
      ? normalizeSourcePath(importModule.resolvedModule.resolvedFileName)
      : undefined);
  if (!targetPath) {
    return undefined;
  }

  const targetSourceFile = ctx.sourceFilesByPath.get(normalizeSourcePath(targetPath));
  if (!targetSourceFile) {
    return undefined;
  }

  const declaration = resolveExportedDeclaration(
    ctx,
    targetSourceFile,
    exportName
  );
  if (!declaration) {
    return undefined;
  }

  return {
    declaration,
    sourceFilePath: normalizeSourcePath(
      sourceFileNameOf(getTstsContainingSourceFile(declaration)) ?? targetPath
    ),
    exportName,
  };
};
