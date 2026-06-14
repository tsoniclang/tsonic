/**
 * Binding Loader - package discovery + loading functions
 *
 * Discovers and loads binding manifest files from configured type roots and
 * their dependency graphs.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { TstsNode, TstsSourceFile } from "@tsonic/tsts";
import {
  createExtensionModuleGraph,
  getTstsDeclaredTypeNode,
  getTstsHeritageClauseDetails,
  getTstsIdentifierText,
  getTstsInitializerNode,
  getTstsMemberNodes,
  getTstsNodeNameText,
  getTstsNodeText,
  getTstsParameters,
  getTstsPropertyNameText,
  getTstsStatementNodes,
  hasTstsPrivateModifier,
  hasTstsProtectedModifier,
  hasTstsStaticModifier,
  parseTstsSourceFile,
  TstsSyntax,
  type ExtensionSourceModule,
} from "@tsonic/tsts";
import type {
  BindingFile,
  MemberBinding,
  SimpleBindingDescriptor,
  TypeBinding,
} from "./binding-types.js";
import { TSONIC_BINDINGS_SCHEMA, validateBindingFile } from "./binding-types.js";
import { BindingRegistry } from "./binding-registry.js";
import { resolveDependencyPackageRoot } from "./package-roots.js";
import { getClassNameFromPath } from "../resolver/naming.js";
import { getNamespaceFromPath } from "../resolver/namespace.js";
import {
  readSourcePackageMetadata,
  type SourcePackageMetadata,
} from "./source-package-metadata.js";

/**
 * Recursively scan a directory for .d.ts files
 * Reuses the same helper as metadata loading
 */
export const scanForDeclarationFiles = (dir: string): readonly string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanForDeclarationFiles(fullPath));
    } else if (entry.name.endsWith(".d.ts")) {
      results.push(fullPath);
    }
  }

  return results;
};

const definedNodes = (
  nodes: readonly (TstsNode | undefined)[]
): readonly TstsNode[] =>
  nodes.filter((node): node is TstsNode => node !== undefined);

type TopLevelSymbolKind =
  | "class"
  | "enum"
  | "function"
  | "interface"
  | "variable";

type TopLevelSymbol = {
  readonly name: string;
  readonly kind: TopLevelSymbolKind;
  readonly node: TstsNode;
};

type ExportedTopLevelSymbol = {
  readonly exportName: string;
  readonly localName: string;
  readonly kind: TopLevelSymbolKind;
  readonly node: TstsNode;
};

type SyntheticSourceMember = {
  readonly alias: string;
  readonly kind: "method" | "property";
  readonly parameterCount?: number;
};

type SyntheticClassMemberScope = "instance" | "static";

const getSourcePackageNamespace = (metadata: SourcePackageMetadata): string =>
  metadata.namespace;

const readSourceFile = (
  sourceFilePath: string
): TstsSourceFile | undefined => {
  if (!fs.existsSync(sourceFilePath)) {
    return undefined;
  }

  return parseTstsSourceFile(fs.readFileSync(sourceFilePath, "utf-8"), {
    fileName: sourceFilePath,
  });
};

type AmbientSourceFile = {
  readonly filePath: string;
  readonly sourceFile: TstsSourceFile;
};

const readAmbientSourceFiles = (
  metadata: SourcePackageMetadata
): readonly AmbientSourceFile[] =>
  metadata.ambientPaths
    .map((filePath) => {
      const sourceFile = readSourceFile(filePath);
      return sourceFile ? { filePath, sourceFile } : undefined;
    })
    .filter((entry): entry is AmbientSourceFile => entry !== undefined);

const getVariableDeclarations = (
  statement: TstsNode
): readonly TstsNode[] => {
  const declarationList = TstsSyntax.AsVariableStatement(statement)
    ?.DeclarationList;
  return definedNodes(
    TstsSyntax.AsVariableDeclarationList(declarationList)?.Declarations
      ?.Nodes ?? []
  );
};

const getSourceFileStatements = (
  sourceFile: TstsSourceFile
): readonly TstsNode[] => definedNodes(getTstsStatementNodes(sourceFile));

const getStringLiteralText = (node: TstsNode | undefined): string | undefined =>
  node && TstsSyntax.IsStringLiteral(node) ? getTstsNodeText(node) : undefined;

const sourceModuleCache = new WeakMap<TstsSourceFile, ExtensionSourceModule>();

const getSourceModule = (
  sourceFile: TstsSourceFile
): ExtensionSourceModule | undefined => {
  const cached = sourceModuleCache.get(sourceFile);
  if (cached) {
    return cached;
  }
  const module =
    createExtensionModuleGraph(undefined, [sourceFile]).getSourceFileModule(
      sourceFile
    );
  if (module) {
    sourceModuleCache.set(sourceFile, module);
  }
  return module;
};

const getRightmostEntityNameText = (node: TstsNode): string | undefined => {
  const identifier = getTstsIdentifierText(node);
  if (identifier) return identifier;
  const qualified = TstsSyntax.AsQualifiedName(node);
  return qualified?.Right
    ? getRightmostEntityNameText(qualified.Right)
    : undefined;
};

const getLeftmostEntityName = (node: TstsNode): TstsNode | undefined => {
  if (TstsSyntax.IsIdentifier(node)) return node;
  const qualified = TstsSyntax.AsQualifiedName(node);
  return qualified?.Left ? getLeftmostEntityName(qualified.Left) : undefined;
};

const resolveExplicitSourceExportPath = (
  metadata: SourcePackageMetadata,
  exportSubpath: string
): string | undefined => {
  const relativeTarget = metadata.exports[exportSubpath];
  if (!relativeTarget) {
    return undefined;
  }

  const sourceFilePath = path.resolve(metadata.packageRoot, relativeTarget);
  return fs.existsSync(sourceFilePath) ? sourceFilePath : undefined;
};

const collectTopLevelSymbols = (
  sourceFile: TstsSourceFile
): ReadonlyMap<string, TopLevelSymbol> => {
  const symbols = new Map<string, TopLevelSymbol>();

  for (const statement of getTstsStatementNodes(sourceFile)) {
    if (!statement) continue;
    const name = getTstsNodeNameText(statement);
    if (TstsSyntax.IsClassDeclaration(statement) && name) {
      symbols.set(name, {
        name,
        kind: "class",
        node: statement,
      });
      continue;
    }

    if (TstsSyntax.IsEnumDeclaration(statement) && name) {
      symbols.set(name, {
        name,
        kind: "enum",
        node: statement,
      });
      continue;
    }

    if (TstsSyntax.IsFunctionDeclaration(statement) && name) {
      symbols.set(name, {
        name,
        kind: "function",
        node: statement,
      });
      continue;
    }

    if (TstsSyntax.IsInterfaceDeclaration(statement) && name) {
      symbols.set(name, {
        name,
        kind: "interface",
        node: statement,
      });
      continue;
    }

    if (!TstsSyntax.IsVariableStatement(statement)) {
      continue;
    }

    for (const declaration of getVariableDeclarations(statement)) {
      const declarationName = getTstsIdentifierText(
        TstsSyntax.Node_Name(declaration)
      );
      if (!declarationName) continue;

      symbols.set(declarationName, {
        name: declarationName,
        kind: "variable",
        node: declaration,
      });
    }
  }

  return symbols;
};

const collectExportedTopLevelSymbols = (
  sourceFile: TstsSourceFile
): readonly ExportedTopLevelSymbol[] => {
  const topLevel = collectTopLevelSymbols(sourceFile);
  const exported: ExportedTopLevelSymbol[] = [];
  const seen = new Set<string>();

  const pushSymbol = (
    exportName: string,
    localName: string,
    symbol: TopLevelSymbol | undefined
  ): void => {
    if (!symbol) {
      return;
    }
    const key = `${exportName}::${localName}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    exported.push({
      exportName,
      localName,
      kind: symbol.kind,
      node: symbol.node,
    });
  };

  for (const binding of getSourceModule(sourceFile)?.exports ?? []) {
    if (binding.sourceSpecifier) {
      continue;
    }
    const exportName =
      binding.exportedName ??
      (binding.kind === "default" || binding.kind === "export-equals"
        ? "default"
        : undefined);
    const localName = binding.localName ?? exportName;
    if (!exportName || !localName) {
      continue;
    }
    pushSymbol(exportName, localName, topLevel.get(localName));
  }

  return exported;
};

const resolveTopLevelBindingHostType = (
  filePath: string,
  metadata: SourcePackageMetadata,
  localName: string,
  kind: TopLevelSymbolKind
): string => {
  const namespace = getNamespaceFromPath(
    filePath,
    metadata.sourceRoot,
    getSourcePackageNamespace(metadata)
  );
  if (kind === "class" || kind === "enum" || kind === "interface") {
    return `${namespace}.${localName}`;
  }
  return `${namespace}.${getClassNameFromPath(filePath)}`;
};

const resolveTopLevelExportOwner = (
  filePath: string,
  metadata: SourcePackageMetadata,
  localName: string,
  kind: TopLevelSymbolKind
): string => {
  const namespace = getNamespaceFromPath(
    filePath,
    metadata.sourceRoot,
    getSourcePackageNamespace(metadata)
  );
  if (kind === "class" || kind === "enum" || kind === "interface") {
    return `${namespace}.${localName}`;
  }
  return `${namespace}.${getClassNameFromPath(filePath)}.${localName}`;
};

const resolveExportOwnerType = (
  sourceFilePath: string,
  exportName: string,
  metadata: SourcePackageMetadata
): string | undefined => {
  const sourceFile = readSourceFile(sourceFilePath);
  if (!sourceFile) {
    return undefined;
  }

  const exportedSymbols = collectExportedTopLevelSymbols(sourceFile);
  const symbol = exportedSymbols.find(
    (candidate) => candidate.exportName === exportName
  );
  if (!symbol) {
    return undefined;
  }

  return resolveTopLevelExportOwner(
    sourceFilePath,
    metadata,
    symbol.localName,
    symbol.kind
  );
};

const collectSyntheticSourceMembers = (
  sourceFilePath: string
): readonly SyntheticSourceMember[] => {
  const sourceFile = readSourceFile(sourceFilePath);
  if (!sourceFile) {
    return [];
  }

  const members: SyntheticSourceMember[] = [];

  for (const symbol of collectExportedTopLevelSymbols(sourceFile)) {
    if (symbol.kind === "function") {
      members.push({
        alias: symbol.exportName,
        kind: "method",
        parameterCount: getTstsParameters(symbol.node).length,
      });
      continue;
    }

    if (symbol.kind !== "variable") {
      continue;
    }

    const initializer = getTstsInitializerNode(symbol.node);
    if (
      initializer &&
      (TstsSyntax.IsArrowFunction(initializer) ||
        TstsSyntax.IsFunctionExpression(initializer))
    ) {
      members.push({
        alias: symbol.exportName,
        kind: "method",
        parameterCount: getTstsParameters(initializer).length,
      });
      continue;
    }

    members.push({ alias: symbol.exportName, kind: "property" });
  }

  return members;
};

const readClassMemberName = (
  member: TstsNode
): string | undefined => {
  return getTstsPropertyNameText(member);
};

const collectSyntheticClassMembers = (
  declaration: TstsNode,
  scope: SyntheticClassMemberScope
): readonly SyntheticSourceMember[] => {
  const members: SyntheticSourceMember[] = [];

  const matchesScope = (member: TstsNode): boolean => {
    const isStatic = hasTstsStaticModifier(member);
    return scope === "static" ? isStatic : !isStatic;
  };

  const isPubliclyAccessible = (member: TstsNode): boolean =>
    !hasTstsPrivateModifier(member) && !hasTstsProtectedModifier(member);

  for (const member of definedNodes(getTstsMemberNodes(declaration))) {
    if (!matchesScope(member) || !isPubliclyAccessible(member)) {
      continue;
    }
    const memberName = readClassMemberName(member);

    if (TstsSyntax.IsMethodDeclaration(member) && memberName) {
      members.push({
        alias: memberName,
        kind: "method",
        parameterCount: getTstsParameters(member).length,
      });
      continue;
    }

    if (
      (TstsSyntax.IsPropertyDeclaration(member) ||
        TstsSyntax.IsGetAccessorDeclaration(member) ||
        TstsSyntax.IsSetAccessorDeclaration(member)) &&
      memberName
    ) {
      members.push({
        alias: memberName,
        kind: "property",
      });
    }
  }

  return members;
};

const collectSyntheticInterfaceMembers = (
  declaration: TstsNode
): readonly SyntheticSourceMember[] => {
  const members: SyntheticSourceMember[] = [];

  for (const member of definedNodes(getTstsMemberNodes(declaration))) {
    const memberName = readClassMemberName(member);
    if (TstsSyntax.IsMethodSignatureDeclaration(member) && memberName) {
      members.push({
        alias: memberName,
        kind: "method",
        parameterCount: getTstsParameters(member).length,
      });
      continue;
    }

    if (TstsSyntax.IsPropertySignatureDeclaration(member) && memberName) {
      members.push({
        alias: memberName,
        kind: "property",
      });
    }
  }

  return members;
};

const getAmbientGlobalStatements = (
  sourceFile: TstsSourceFile
): readonly TstsNode[] => {
  const declareGlobalStatements = getSourceFileStatements(sourceFile).flatMap((statement) => {
    if (
      TstsSyntax.IsModuleDeclaration(statement) &&
      getTstsNodeNameText(statement) === "global"
    ) {
      const body = TstsSyntax.Node_Body(statement);
      return body && TstsSyntax.IsModuleBlock(body)
        ? definedNodes(getTstsStatementNodes(body))
        : [];
    }
    return [];
  });

  return declareGlobalStatements.length > 0
    ? declareGlobalStatements
    : getSourceFileStatements(sourceFile);
};

const findImportedTypeTarget = (
  sourceFile: TstsSourceFile,
  localName: string
): { readonly specifier: string; readonly exportName: string } | undefined => {
  for (const importModule of getSourceModule(sourceFile)?.imports ?? []) {
    for (const binding of importModule.bindings) {
      if (binding.localName !== localName) {
        continue;
      }
      return {
        specifier: importModule.specifier,
        exportName: binding.importedName,
      };
    }
  }

  return undefined;
};

const hasExportedTypeLikeSymbol = (
  sourceFile: TstsSourceFile,
  exportName: string
): boolean => {
  return collectExportedTopLevelSymbols(sourceFile).some(
    (symbol) =>
      symbol.localName === exportName || symbol.exportName === exportName
  );
};

type AmbientInterfaceSourceOwner = {
  readonly filePath: string;
  readonly exportName: string;
};

type AmbientInterfaceResolvedOwnerMember = {
  readonly bindingType: string;
  readonly kind: SyntheticSourceMember["kind"];
  readonly parameterCount: number | undefined;
  readonly isExtensionMethod: boolean;
  readonly sourceFilePath: string;
  readonly exportName: string;
  readonly memberName: string;
};

const listAmbientInterfaceOwnerMembers = (
  _metadata: SourcePackageMetadata,
  ownerTarget: AmbientInterfaceSourceOwner
): readonly SyntheticSourceMember[] => {
  const ownerFile = ownerTarget.filePath;
  const ownerSourceFile = readSourceFile(ownerFile);
  if (!ownerSourceFile) {
    return [];
  }

  const exportedSymbol = collectExportedTopLevelSymbols(ownerSourceFile).find(
    (symbol) => symbol.exportName === ownerTarget.exportName
  );
  if (!exportedSymbol) {
    return collectSyntheticSourceMembers(ownerFile);
  }

  if (exportedSymbol.kind === "class") {
    const instanceMembers = collectSyntheticClassMembers(
      exportedSymbol.node,
      "instance"
    );
    if (instanceMembers.length > 0) {
      return instanceMembers;
    }

    return collectSyntheticClassMembers(exportedSymbol.node, "static")
      .filter((member) => member.kind === "method")
      .map((member) => ({
        ...member,
        parameterCount:
          typeof member.parameterCount === "number"
            ? Math.max(0, member.parameterCount - 1)
            : undefined,
      }));
  }

  if (exportedSymbol.kind === "interface") {
    return collectSyntheticInterfaceMembers(exportedSymbol.node);
  }

  return collectSyntheticSourceMembers(ownerFile);
};

const resolveAmbientInterfaceExplicitOwners = (
  metadata: SourcePackageMetadata,
  interfaceName: string
): readonly AmbientInterfaceSourceOwner[] => {
  const sourceFilePath = resolveExplicitSourceExportPath(
    metadata,
    `./${interfaceName}.js`
  );
  if (!sourceFilePath) {
    return [];
  }

  return [
    {
      filePath: sourceFilePath,
      exportName: interfaceName,
    },
  ];
};

const resolveAmbientInterfaceSourceOwners = (
  ambientFilePath: string,
  declaration: TstsNode
): readonly AmbientInterfaceSourceOwner[] => {
  const owners: AmbientInterfaceSourceOwner[] = [];
  const seen = new Set<string>();
  const ambientSourceFile = readSourceFile(ambientFilePath);
  if (!ambientSourceFile) {
    return [];
  }

  for (const heritageClause of getTstsHeritageClauseDetails(declaration)) {
    if (heritageClause.kind !== "extends") continue;

    for (const heritageType of heritageClause.types) {
      if (!heritageType) continue;
      const expression = TstsSyntax.Node_Expression(heritageType);
      const expressionName = expression
        ? getTstsIdentifierText(expression)
        : undefined;
      if (!expressionName) continue;
      const target = findImportedTypeTarget(
        ambientSourceFile,
        expressionName
      );
      if (!target) {
        continue;
      }

      const sourceFilePath = resolveSourceImportFilePath(
        ambientFilePath,
        target.specifier
      );
      const ownerKey = `${sourceFilePath ?? ""}::${target.exportName}`;
      if (!sourceFilePath || seen.has(ownerKey)) {
        continue;
      }

      const sourceFile = readSourceFile(sourceFilePath);
      if (
        !sourceFile ||
        !hasExportedTypeLikeSymbol(sourceFile, target.exportName)
      ) {
        continue;
      }

      seen.add(ownerKey);
      owners.push({
        filePath: sourceFilePath,
        exportName: target.exportName,
      });
    }
  }

  return owners;
};

const resolveAmbientInterfaceValueOwners = (
  ambientFilePath: string,
  interfaceName: string
): readonly AmbientInterfaceSourceOwner[] => {
  const ambientSourceFile = readSourceFile(ambientFilePath);
  if (!ambientSourceFile) {
    return [];
  }

  const owners: AmbientInterfaceSourceOwner[] = [];
  const seen = new Set<string>();

  for (const statement of getAmbientGlobalStatements(ambientSourceFile)) {
    if (!TstsSyntax.IsVariableStatement(statement)) {
      continue;
    }

    for (const declaration of getVariableDeclarations(statement)) {
      const declarationName = getTstsIdentifierText(
        TstsSyntax.Node_Name(declaration)
      );
      if (declarationName !== interfaceName) {
        continue;
      }

      for (const target of extractImportTypeTargets(
        declaration,
        ambientSourceFile
      )) {
        const sourceFilePath = resolveSourceImportFilePath(
          ambientFilePath,
          target.specifier
        );
        const ownerKey = `${sourceFilePath ?? ""}::${target.exportName}`;
        if (!sourceFilePath || seen.has(ownerKey)) {
          continue;
        }

        seen.add(ownerKey);
        owners.push({
          filePath: sourceFilePath,
          exportName: target.exportName,
        });
      }
    }
  }

  return owners;
};

const resolveAmbientInterfaceOwnerMember = (
  metadata: SourcePackageMetadata,
  ownerTarget: AmbientInterfaceSourceOwner,
  surfacedMember: SyntheticSourceMember
): AmbientInterfaceResolvedOwnerMember | undefined => {
  const ownerFile = ownerTarget.filePath;
  const ownerSourceFile = readSourceFile(ownerFile);
  if (!ownerSourceFile) {
    return undefined;
  }

  const exportedSymbol = collectExportedTopLevelSymbols(ownerSourceFile).find(
    (symbol) => symbol.exportName === ownerTarget.exportName
  );
  const ownerType = exportedSymbol
    ? resolveTopLevelBindingHostType(
        ownerFile,
        metadata,
        exportedSymbol.localName,
        exportedSymbol.kind
      )
    : resolveTopLevelBindingHostType(
        ownerFile,
        metadata,
        getClassNameFromPath(ownerFile),
        "function"
      );

  const usesTypeLikeOwner =
    exportedSymbol?.kind === "class" ||
    exportedSymbol?.kind === "interface" ||
    exportedSymbol?.kind === "enum";

  if (!usesTypeLikeOwner) {
    const ownerMembers = collectSyntheticSourceMembers(ownerFile);
    const ownerMember = ownerMembers.find(
      (member) => member.alias === surfacedMember.alias
    );
    if (!ownerMember) {
      return undefined;
    }

    return {
      bindingType: ownerType,
      kind: ownerMember.kind,
      parameterCount:
        ownerMember.kind === "method" &&
        typeof ownerMember.parameterCount === "number"
          ? Math.max(0, ownerMember.parameterCount - 1)
          : ownerMember.parameterCount,
      isExtensionMethod: ownerMember.kind === "method",
      sourceFilePath: ownerFile,
      exportName: ownerMember.alias,
      memberName: ownerMember.alias,
    };
  }

  if (exportedSymbol?.kind === "class") {
    const instanceMembers = collectSyntheticClassMembers(
      exportedSymbol.node,
      "instance"
    );
    const instanceMember = instanceMembers.find(
      (member) => member.alias === surfacedMember.alias
    );
    if (instanceMember) {
      return {
        bindingType: ownerType,
        kind: instanceMember.kind,
        parameterCount: instanceMember.parameterCount,
        isExtensionMethod: false,
        sourceFilePath: ownerFile,
        exportName: ownerTarget.exportName,
        memberName: instanceMember.alias,
      };
    }

    if (surfacedMember.kind === "method") {
      const staticMembers = collectSyntheticClassMembers(
        exportedSymbol.node,
        "static"
      );
      const staticExtensionMember = staticMembers.find(
        (member) =>
          member.alias === surfacedMember.alias &&
          member.kind === "method" &&
          typeof member.parameterCount === "number" &&
          member.parameterCount === (surfacedMember.parameterCount ?? 0) + 1
      );
      if (staticExtensionMember) {
        return {
          bindingType: ownerType,
          kind: staticExtensionMember.kind,
          parameterCount:
            typeof staticExtensionMember.parameterCount === "number"
              ? Math.max(0, staticExtensionMember.parameterCount - 1)
              : undefined,
          isExtensionMethod: true,
          sourceFilePath: ownerFile,
          exportName: ownerTarget.exportName,
          memberName: staticExtensionMember.alias,
        };
      }
    }

    return undefined;
  }

  if (exportedSymbol?.kind === "interface") {
    const interfaceMembers = collectSyntheticInterfaceMembers(
      exportedSymbol.node
    );
    const interfaceMember = interfaceMembers.find(
      (member) => member.alias === surfacedMember.alias
    );
    if (!interfaceMember) {
      return undefined;
    }

    return {
      bindingType: ownerType,
      kind: interfaceMember.kind,
      parameterCount: interfaceMember.parameterCount,
      isExtensionMethod: false,
      sourceFilePath: ownerFile,
      exportName: ownerTarget.exportName,
      memberName: interfaceMember.alias,
    };
  }

  return undefined;
};

const collectAmbientTypeIdentityNames = (
  sourceFile: TstsSourceFile
): ReadonlySet<string> => {
  const names = new Set<string>();

  for (const statement of getAmbientGlobalStatements(sourceFile)) {
    if (
      TstsSyntax.IsInterfaceDeclaration(statement) ||
      TstsSyntax.IsClassDeclaration(statement) ||
      TstsSyntax.IsEnumDeclaration(statement) ||
      TstsSyntax.IsTypeAliasDeclaration(statement)
    ) {
      const name = getTstsNodeNameText(statement);
      if (name) names.add(name);
    }
  }

  return names;
};

const createSyntheticAmbientInterfaceBindings = (
  metadata: SourcePackageMetadata
): readonly TypeBinding[] => {
  const ambientSources = readAmbientSourceFiles(metadata);
  if (ambientSources.length === 0) {
    return [];
  }

  const bindings = new Map<string, TypeBinding>();
  const sourceNamespace = getSourcePackageNamespace(metadata);

  for (const { filePath, sourceFile } of ambientSources) {
    for (const statement of getAmbientGlobalStatements(sourceFile)) {
      if (!TstsSyntax.IsInterfaceDeclaration(statement)) {
        continue;
      }
      const interfaceName = getTstsNodeNameText(statement);
      if (!interfaceName) continue;

      const declaredMembers = collectSyntheticInterfaceMembers(statement);

      const ownerTargets = resolveAmbientInterfaceExplicitOwners(
        metadata,
        interfaceName
      );
      const explicitOrHeritageOwners =
        ownerTargets.length > 0
          ? ownerTargets
          : resolveAmbientInterfaceSourceOwners(filePath, statement);
      const resolvedOwnerTargets =
        explicitOrHeritageOwners.length > 0
          ? explicitOrHeritageOwners
          : resolveAmbientInterfaceValueOwners(filePath, interfaceName);

      const alias = interfaceName;
      const existing = bindings.get(alias) ?? {
        name: `${sourceNamespace}.${alias}`,
        alias,
        kind: "interface" as const,
        members: [],
      };
      const existingMembers = [...existing.members];
      const seenMembers = new Set(
        existingMembers.map(
          (member) => `${member.alias}::${member.binding.type}`
        )
      );

      if (resolvedOwnerTargets.length === 0) {
        for (const member of declaredMembers) {
          const key = `${member.alias}::${existing.name}`;
          if (seenMembers.has(key)) {
            continue;
          }
          seenMembers.add(key);
          existingMembers.push({
            kind: member.kind,
            name: member.alias,
            alias: member.alias,
            parameterCount: member.parameterCount,
            binding: {
              ownerIdentity: sourceNamespace,
              type: existing.name,
              member: member.alias,
            },
            sourceOrigin: {
              filePath,
              exportName: alias,
              memberName: member.alias,
            },
          });
        }

        if (existingMembers.length === 0) {
          continue;
        }

        bindings.set(alias, {
          ...existing,
          members: existingMembers,
        });
        continue;
      }

      for (const ownerTarget of resolvedOwnerTargets) {
        const surfacedMembers =
          declaredMembers.length > 0
            ? declaredMembers
            : listAmbientInterfaceOwnerMembers(metadata, ownerTarget);

        for (const member of surfacedMembers) {
          const resolvedOwnerMember = resolveAmbientInterfaceOwnerMember(
            metadata,
            ownerTarget,
            member
          );
          if (!resolvedOwnerMember) {
            continue;
          }

          const key = `${member.alias}::${resolvedOwnerMember.bindingType}`;
          if (seenMembers.has(key)) {
            continue;
          }
          seenMembers.add(key);
          existingMembers.push({
            kind: resolvedOwnerMember.kind,
            name: resolvedOwnerMember.memberName,
            alias: member.alias,
            parameterCount: resolvedOwnerMember.parameterCount,
            binding: {
              ownerIdentity: sourceNamespace,
              type: resolvedOwnerMember.bindingType,
              member: resolvedOwnerMember.memberName,
            },
            isExtensionMethod: resolvedOwnerMember.isExtensionMethod
              ? true
              : undefined,
            sourceOrigin: {
              filePath: resolvedOwnerMember.sourceFilePath,
              exportName: resolvedOwnerMember.exportName,
              memberName: resolvedOwnerMember.memberName,
            },
          });
        }
      }

      bindings.set(alias, {
        ...existing,
        members: existingMembers,
      });
    }
  }

  return [...bindings.values()];
};

const createSyntheticWrapperType = (
  metadata: SourcePackageMetadata,
  typeAlias: string
): TypeBinding | undefined => {
  const sourceFilePath = resolveExplicitSourceExportPath(
    metadata,
    `./${typeAlias}.js`
  );
  if (!sourceFilePath) {
    return undefined;
  }

  const sourceFile = readSourceFile(sourceFilePath);
  if (!sourceFile) {
    return undefined;
  }

  const exportedSymbol = collectExportedTopLevelSymbols(sourceFile).find(
    (symbol) => symbol.exportName === typeAlias
  );
  const ownerType =
    exportedSymbol &&
    (exportedSymbol.kind === "class" || exportedSymbol.kind === "enum")
      ? resolveTopLevelBindingHostType(
          sourceFilePath,
          metadata,
          exportedSymbol.localName,
          exportedSymbol.kind
        )
      : resolveTopLevelBindingHostType(
          sourceFilePath,
          metadata,
          getClassNameFromPath(sourceFilePath),
          "function"
        );
  const members =
    exportedSymbol?.kind === "class"
      ? collectSyntheticClassMembers(
          exportedSymbol.node,
          "static"
        )
      : collectSyntheticSourceMembers(sourceFilePath);
  if (members.length === 0) {
    return undefined;
  }

  return {
    name: ownerType,
    alias: typeAlias,
    kind: "class",
    members: members.map(
      (member): MemberBinding => ({
        kind: member.kind,
        name: member.alias,
        alias: member.alias,
        parameterCount: member.parameterCount,
        binding: {
          ownerIdentity: getSourcePackageNamespace(metadata),
          type: ownerType,
          member: member.alias,
        },
        sourceOrigin: {
          filePath: sourceFilePath,
          exportName:
            exportedSymbol?.kind === "class" ? typeAlias : member.alias,
          memberName:
            exportedSymbol?.kind === "class" ? member.alias : undefined,
        },
      })
    ),
  };
};

const createSyntheticSourceTypeBindings = (
  metadata: SourcePackageMetadata
): readonly TypeBinding[] => {
  const types: TypeBinding[] = [
    ...createSyntheticAmbientInterfaceBindings(metadata),
  ];
  const usedAliases = new Set(types.map((type) => type.alias));
  const explicitWrapperExports = new Set<string>();

  for (const wrapperAlias of ["String", "Number", "Boolean"]) {
    const wrapper = createSyntheticWrapperType(metadata, wrapperAlias);
    if (!wrapper) {
      continue;
    }
    const registeredWrapper = usedAliases.has(wrapper.alias)
      ? {
          ...wrapper,
          alias: `${wrapper.alias}$static`,
        }
      : wrapper;
    types.push(registeredWrapper);
    usedAliases.add(registeredWrapper.alias);
    explicitWrapperExports.add(wrapperAlias);
  }

  for (const sourceFilePath of metadata.exportPaths) {
    const sourceFile = readSourceFile(sourceFilePath);
    if (!sourceFile) {
      continue;
    }

    for (const symbol of collectExportedTopLevelSymbols(sourceFile)) {
      if (symbol.kind !== "class" && symbol.kind !== "enum") {
        continue;
      }
      if (explicitWrapperExports.has(symbol.exportName)) {
        continue;
      }

      const ownerType = resolveTopLevelBindingHostType(
        sourceFilePath,
        metadata,
        symbol.localName,
        symbol.kind
      );
      const alias = usedAliases.has(symbol.exportName)
        ? `${symbol.exportName}$static`
        : symbol.exportName;
      usedAliases.add(alias);

      types.push({
        name: ownerType,
        alias,
        kind: symbol.kind === "enum" ? "enum" : "class",
        members:
          symbol.kind === "class" && TstsSyntax.IsClassDeclaration(symbol.node)
            ? collectSyntheticClassMembers(symbol.node, "static").map(
                (member): MemberBinding => ({
                  kind: member.kind,
                  name: member.alias,
                  alias: member.alias,
                  parameterCount: member.parameterCount,
                  binding: {
                    ownerIdentity: getSourcePackageNamespace(metadata),
                    type: ownerType,
                    member: member.alias,
                  },
                })
              )
            : [],
      });
    }
  }

  return types;
};

const resolveSourceImportFilePath = (
  ambientFilePath: string,
  specifier: string
): string | undefined => {
  const base = path.resolve(path.dirname(ambientFilePath), specifier);
  const candidates = [
    base,
    base.replace(/\.js$/i, ".ts"),
    base.replace(/\.mjs$/i, ".mts"),
    `${base}.ts`,
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
};

const resolveSourceImportSpecifier = (
  metadata: SourcePackageMetadata,
  sourceFilePath: string
): string | undefined => {
  const normalizedFilePath = path.resolve(sourceFilePath);
  const candidates = Object.entries(metadata.exports)
    .filter(
      ([, target]) =>
        path.resolve(metadata.packageRoot, target) === normalizedFilePath
    )
    .map(([exportKey]) => exportKey)
    .sort((left, right) => {
      if (left === ".") return 1;
      if (right === ".") return -1;
      return left.localeCompare(right);
    });

  const exportKey = candidates[0];
  if (!exportKey) {
    return undefined;
  }

  if (exportKey === ".") {
    const explicitRoot = metadata.exports["./index.js"] ? "./index.js" : ".";
    return explicitRoot === "."
      ? metadata.packageName
      : `${metadata.packageName}/${explicitRoot.slice(2)}`;
  }

  return `${metadata.packageName}/${exportKey.slice(2)}`;
};

const resolveGlobalOwnerByExportName = (
  metadata: SourcePackageMetadata,
  exportName: string
):
  | { readonly ownerType: string; readonly sourceImport: string }
  | undefined => {
  const candidatePaths = [...metadata.exportPaths].sort((left, right) => {
    const leftBase = path.basename(left, path.extname(left)).toLowerCase();
    const rightBase = path.basename(right, path.extname(right)).toLowerCase();
    const target = exportName.toLowerCase();
    const leftRank =
      leftBase === target ? 0 : leftBase.includes(target) ? 1 : 2;
    const rightRank =
      rightBase === target ? 0 : rightBase.includes(target) ? 1 : 2;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.localeCompare(right);
  });

  for (const sourceFilePath of candidatePaths) {
    const ownerType = resolveExportOwnerType(
      sourceFilePath,
      exportName,
      metadata
    );
    const sourceImport = resolveSourceImportSpecifier(metadata, sourceFilePath);
    if (!ownerType || !sourceImport) {
      continue;
    }
    return { ownerType, sourceImport };
  }

  return undefined;
};

const extractImportTypeTargetFromTypeNode = (
  typeNode: TstsNode,
  sourceFile: TstsSourceFile
): { readonly specifier: string; readonly exportName: string } | undefined => {
  if (TstsSyntax.IsImportTypeNode(typeNode)) {
    const importType = TstsSyntax.AsImportTypeNode(typeNode);
    if (importType?.IsTypeOf !== true) {
      return undefined;
    }
    const argumentLiteral =
      importType.Argument && TstsSyntax.IsLiteralTypeNode(importType.Argument)
        ? TstsSyntax.AsLiteralTypeNode(importType.Argument)?.Literal
        : undefined;
    const specifier = getStringLiteralText(argumentLiteral);
    if (!specifier || !importType.Qualifier) {
      return undefined;
    }

    const exportName = getRightmostEntityNameText(importType.Qualifier);
    if (!exportName || exportName.length === 0) {
      return undefined;
    }

    return {
      specifier,
      exportName,
    };
  }

  if (!TstsSyntax.IsTypeQueryNode(typeNode)) {
    return undefined;
  }

  const exprName = TstsSyntax.AsTypeQueryNode(typeNode)?.ExprName;
  const rootIdentifier = exprName ? getLeftmostEntityName(exprName) : undefined;
  const rootIdentifierText = rootIdentifier
    ? getTstsIdentifierText(rootIdentifier)
    : undefined;
  if (!rootIdentifierText) {
    return undefined;
  }

  return findImportedTypeTarget(sourceFile, rootIdentifierText);
};

const extractImportTypeTargets = (
  declaration: TstsNode,
  sourceFile: TstsSourceFile
): readonly { readonly specifier: string; readonly exportName: string }[] => {
  const seen = new Set<string>();
  const targets: { specifier: string; exportName: string }[] = [];

  const pushTarget = (
    target:
      | {
          readonly specifier: string;
          readonly exportName: string;
        }
      | undefined
  ): void => {
    if (!target) {
      return;
    }

    const key = `${target.specifier}::${target.exportName}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    targets.push(target);
  };

  const visitTypeNode = (node: TstsNode | undefined): void => {
    if (!node) {
      return;
    }

    if (TstsSyntax.IsIntersectionTypeNode(node)) {
      for (const member of definedNodes(
        TstsSyntax.AsIntersectionTypeNode(node)?.Types?.Nodes ?? []
      )) {
        visitTypeNode(member);
      }
      return;
    }

    if (TstsSyntax.IsParenthesizedTypeNode(node)) {
      visitTypeNode(TstsSyntax.AsParenthesizedTypeNode(node)?.Type);
      return;
    }

    if (TstsSyntax.IsImportTypeNode(node) || TstsSyntax.IsTypeQueryNode(node)) {
      pushTarget(
        extractImportTypeTargetFromTypeNode(node, sourceFile)
      );
    }
  };

  visitTypeNode(getTstsDeclaredTypeNode(declaration));
  return targets;
};

const collectSyntheticSourceGlobals = (
  metadata: SourcePackageMetadata
): BindingFile | undefined => {
  const ambientSources = readAmbientSourceFiles(metadata);
  if (ambientSources.length === 0) {
    return undefined;
  }

  const bindings: Record<string, SimpleBindingDescriptor> = {};
  const sourceNamespace = getSourcePackageNamespace(metadata);
  const ambientTypeIdentityNames = new Set<string>();
  const getTypeSemantics = (
    globalName: string
  ): SimpleBindingDescriptor["typeSemantics"] =>
    ambientTypeIdentityNames.has(globalName)
      ? { contributesTypeIdentity: true }
      : undefined;

  for (const { sourceFile } of ambientSources) {
    for (const typeName of collectAmbientTypeIdentityNames(sourceFile)) {
      ambientTypeIdentityNames.add(typeName);
    }
  }

  const bindGlobalName = (globalName: string): void => {
    const inferred = resolveGlobalOwnerByExportName(metadata, globalName);
    const ownerType = inferred?.ownerType;
    const sourceImport = inferred?.sourceImport;

    if (!ownerType || !sourceImport) {
      return;
    }

    bindings[globalName] = {
      kind: "global",
      ownerIdentity: sourceNamespace,
      type: ownerType,
      staticType: ownerType,
      sourceImport,
      ...(getTypeSemantics(globalName)
        ? { typeSemantics: getTypeSemantics(globalName) }
        : {}),
    };
  };

  for (const { filePath, sourceFile } of ambientSources) {
    for (const globalStatement of getAmbientGlobalStatements(sourceFile)) {
      if (TstsSyntax.IsVariableStatement(globalStatement)) {
        for (const declaration of getVariableDeclarations(globalStatement)) {
          const declarationName = getTstsIdentifierText(
            TstsSyntax.Node_Name(declaration)
          );
          if (!declarationName) continue;

          const explicitTargets = extractImportTypeTargets(
            declaration,
            sourceFile
          );
          let ownerType: string | undefined;
          let staticType: string | undefined;
          let sourceImport: string | undefined;

          if (explicitTargets.length > 0) {
            const resolvedOwners = explicitTargets
              .map((target) => {
                const sourceFilePath = resolveSourceImportFilePath(
                  filePath,
                  target.specifier
                );
                if (!sourceFilePath) {
                  return undefined;
                }

                const resolvedOwnerType = resolveExportOwnerType(
                  sourceFilePath,
                  target.exportName,
                  metadata
                );
                const resolvedSourceImport = resolveSourceImportSpecifier(
                  metadata,
                  sourceFilePath
                );
                if (!resolvedOwnerType || !resolvedSourceImport) {
                  return undefined;
                }

                return {
                  ownerType: resolvedOwnerType,
                  sourceImport: resolvedSourceImport,
                };
              })
              .filter(
                (
                  entry
                ): entry is {
                  readonly ownerType: string;
                  readonly sourceImport: string;
                } => entry !== undefined
              );

            const firstOwner = resolvedOwners[0];
            const lastOwner = resolvedOwners[resolvedOwners.length - 1];
            ownerType = firstOwner?.ownerType;
            staticType = lastOwner?.ownerType;

            const uniqueSourceImports = [
              ...new Set(resolvedOwners.map((entry) => entry.sourceImport)),
            ];
            if (uniqueSourceImports.length === 1) {
              sourceImport = uniqueSourceImports[0];
            } else if (metadata.exports["./index.js"]) {
              sourceImport = `${metadata.packageName}/index.js`;
            } else {
              sourceImport = firstOwner?.sourceImport;
            }
          } else {
            const inferred = resolveGlobalOwnerByExportName(
              metadata,
              declarationName
            );
            ownerType = inferred?.ownerType;
            staticType = inferred?.ownerType;
            sourceImport = inferred?.sourceImport;
          }

          if (!ownerType || !staticType || !sourceImport) {
            continue;
          }

          bindings[declarationName] = {
            kind: "global",
            ownerIdentity: sourceNamespace,
            type: ownerType,
            staticType,
            sourceImport,
            ...(getTypeSemantics(declarationName)
              ? { typeSemantics: getTypeSemantics(declarationName) }
              : {}),
          };
        }
        continue;
      }

      if (
        TstsSyntax.IsFunctionDeclaration(globalStatement) &&
        getTstsNodeNameText(globalStatement)
      ) {
        bindGlobalName(getTstsNodeNameText(globalStatement) ?? "");
        continue;
      }

      if (
        TstsSyntax.IsClassDeclaration(globalStatement) &&
        getTstsNodeNameText(globalStatement)
      ) {
        bindGlobalName(getTstsNodeNameText(globalStatement) ?? "");
        continue;
      }

      if (TstsSyntax.IsEnumDeclaration(globalStatement)) {
        const name = getTstsNodeNameText(globalStatement);
        if (name) bindGlobalName(name);
        continue;
      }

      if (TstsSyntax.IsVariableDeclaration(globalStatement)) {
        const name = getTstsIdentifierText(TstsSyntax.Node_Name(globalStatement));
        if (name) bindGlobalName(name);
        continue;
      }

      if (TstsSyntax.IsModuleDeclaration(globalStatement)) {
        const body = TstsSyntax.Node_Body(globalStatement);
        if (!body || !TstsSyntax.IsModuleBlock(body)) {
          continue;
        }
        for (const nested of definedNodes(getTstsStatementNodes(body))) {
          if (TstsSyntax.IsFunctionDeclaration(nested)) {
            const name = getTstsNodeNameText(nested);
            if (name) bindGlobalName(name);
          }
        }
      }
    }
  }

  return Object.keys(bindings).length > 0
    ? {
        schema: TSONIC_BINDINGS_SCHEMA,
        provider: {
          namespace: sourceNamespace,
          ownerIdentities: [sourceNamespace],
        },
        sourceSurface: { bindings },
        targetSurface: { types: [] },
      }
    : undefined;
};

const addSyntheticSourcePackageBindings = (
  registry: BindingRegistry,
  metadata: SourcePackageMetadata
): void => {
  const sourceNamespace = getSourcePackageNamespace(metadata);
  const syntheticTypes = createSyntheticSourceTypeBindings(metadata);
  if (syntheticTypes.length > 0) {
    const manifest: BindingFile = {
      schema: TSONIC_BINDINGS_SCHEMA,
      provider: {
        namespace: sourceNamespace,
        ownerIdentities: [sourceNamespace],
      },
      sourceSurface: {
        namespaces: [
          {
            name: sourceNamespace,
            alias: sourceNamespace,
            types: syntheticTypes,
          },
        ],
      },
      targetSurface: { types: [] },
    };
    registry.addBindings(
      `${metadata.packageRoot}::synthetic-source-types`,
      manifest
    );
  }

  const simpleGlobals = collectSyntheticSourceGlobals(metadata);
  if (simpleGlobals) {
    registry.addBindings(
      `${metadata.packageRoot}::synthetic-source-globals`,
      simpleGlobals
    );
  }
};

const preserveBindingPackageRootOrder = (
  packageRoots: readonly string[]
): readonly string[] => [...packageRoots];

/**
 * Load bindings from a package directory and recursively from its dependencies.
 *
 * This supports the common "namespace facade" layout:
 * - `<Namespace>.d.ts` (or `index.d.ts`) at the package root
 * - `<Namespace>/bindings.json` (or `index/bindings.json`) next to the namespace's `internal/index.d.ts`
 *
 * Some packages may also provide a root-level `bindings.json` (simple/global bindings).
 */
const loadBindingsFromPackage = (
  registry: BindingRegistry,
  packageRoot: string,
  visited: Set<string>,
  forceDependencyTraversal = false
): void => {
  // Avoid cycles
  const absoluteRoot = path.resolve(packageRoot);
  if (visited.has(absoluteRoot)) {
    return;
  }
  visited.add(absoluteRoot);

  // Skip if directory doesn't exist
  if (!fs.existsSync(absoluteRoot)) {
    return;
  }

  const sourcePackageMetadata = readSourcePackageMetadata(absoluteRoot);
  const sourcePackageRoot = sourcePackageMetadata !== null;
  if (sourcePackageMetadata) {
    addSyntheticSourcePackageBindings(registry, sourcePackageMetadata);
  }
  const rootEntries = fs.readdirSync(absoluteRoot, { withFileTypes: true });
  let discoveredBindingsInPackage = false;

  // Strategy 1: root-level bindings.json (simple/global bindings)
  const rootBindingsPath = path.join(absoluteRoot, "bindings.json");
  if (!sourcePackageRoot && fs.existsSync(rootBindingsPath)) {
    discoveredBindingsInPackage = true;
  }
  if (!sourcePackageRoot) {
    loadBindingsFromPath(registry, rootBindingsPath);
  }

  // Strategy 2: Namespace/bindings.json for each Namespace.d.ts facade
  const facadeFiles = rootEntries
    .filter((e) => e.isFile() && e.name.endsWith(".d.ts"))
    .map((e) => e.name);

  for (const facadeFile of facadeFiles) {
    // e.g., "Provider.d.ts" → "Provider"
    const namespaceName = facadeFile.slice(0, -".d.ts".length);
    const namespaceDir = path.join(absoluteRoot, namespaceName);
    const bindingsPath = path.join(namespaceDir, "bindings.json");

    if (!sourcePackageRoot && fs.existsSync(bindingsPath)) {
      discoveredBindingsInPackage = true;
      loadBindingsFromPath(registry, bindingsPath);
    }
  }

  const hasBindingsManifest =
    !sourcePackageRoot &&
    fs.existsSync(path.join(absoluteRoot, "tsonic.bindings.json"));
  const hasSurfaceManifest = fs.existsSync(
    path.join(absoluteRoot, "tsonic.surface.json")
  );
  const shouldTraverseDependencies =
    forceDependencyTraversal ||
    sourcePackageRoot ||
    discoveredBindingsInPackage ||
    hasBindingsManifest ||
    hasSurfaceManifest;

  // Strategy 3: Recursively load bindings from dependency packages.
  // This is generic (no package-name hardcoding): if a package participates in
  // Tsonic bindings/surface manifests, its dependency tree is eligible.
  // Top-level typeRoots always traverse once to discover transitive bindings.
  const packageJsonPath = path.join(absoluteRoot, "package.json");
  if (shouldTraverseDependencies && fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const dependencyNames = new Set<string>();
      const dependencyBuckets = [
        packageJson.dependencies,
        packageJson.optionalDependencies,
        packageJson.peerDependencies,
      ];
      for (const bucket of dependencyBuckets) {
        if (
          bucket !== null &&
          typeof bucket === "object" &&
          !Array.isArray(bucket)
        ) {
          for (const depName of Object.keys(
            bucket as Record<string, unknown>
          )) {
            dependencyNames.add(depName);
          }
        }
      }

      const dependencyRoots: string[] = [];
      for (const depName of dependencyNames) {
        const dependencyRoot = resolveDependencyPackageRoot(
          absoluteRoot,
          depName
        );
        if (dependencyRoot) {
          dependencyRoots.push(dependencyRoot);
        }
      }

      for (const dependencyRoot of preserveBindingPackageRootOrder(
        dependencyRoots
      )) {
        loadBindingsFromPackage(registry, dependencyRoot, visited, false);
      }
    } catch {
      // Ignore JSON parse errors in package.json
    }
  }
};

/**
 * Load binding manifests from configured type roots.
 *
 * Conventions:
 * - Root-level `bindings.json` (simple/global bindings)
 * - `Namespace.d.ts` + `Namespace/bindings.json` (namespace facade)
 *
 * Also recursively loads bindings from dependency packages.
 */
export const loadBindings = (typeRoots: readonly string[]): BindingRegistry => {
  const registry = new BindingRegistry();
  const visited = new Set<string>();

  for (const typeRoot of preserveBindingPackageRootOrder(typeRoots)) {
    loadBindingsFromPackage(registry, typeRoot, visited, true);
  }

  return registry;
};

/**
 * Load bindings from a specific file path into an existing registry.
 * Validates the file format and logs a warning if invalid.
 */
export const loadBindingsFromPath = (
  registry: BindingRegistry,
  bindingsPath: string
): void => {
  try {
    if (fs.existsSync(bindingsPath)) {
      const content = fs.readFileSync(bindingsPath, "utf-8");
      const parsed = JSON.parse(content) as unknown;

      // Validate the parsed structure
      const validationError = validateBindingFile(parsed, bindingsPath);
      if (validationError) {
        console.warn(`Invalid bindings file: ${validationError}`);
        return;
      }

      registry.addBindings(bindingsPath, parsed as BindingFile);
    }
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.warn(
        `Failed to parse bindings from ${bindingsPath}: Invalid JSON - ${err.message}`
      );
    } else {
      console.warn(`Failed to load bindings from ${bindingsPath}:`, err);
    }
  }
};

/**
 * Load all external bindings discovered by the resolver.
 * This should be called AFTER createProgram but BEFORE IR building
 * to ensure all bindings are available during IR construction.
 *
 * Note: The ExternalBindingsResolver tracks discovered binding paths via caching,
 * so this loads bindings for any imports that were already resolved.
 */
export const loadAllDiscoveredBindings = (
  registry: BindingRegistry,
  discoveredPaths: ReadonlySet<string>
): void => {
  for (const bindingsPath of discoveredPaths) {
    loadBindingsFromPath(registry, bindingsPath);
  }
};
