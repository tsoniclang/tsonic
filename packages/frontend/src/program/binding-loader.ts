/**
 * Binding Loader - package discovery + loading functions
 *
 * Discovers and loads binding manifest files from configured type roots and
 * their dependency graphs.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import type {
  BindingFile,
  FullBindingManifest,
  MemberBinding,
  SimpleBindingDescriptor,
  SimpleBindingFile,
  TypeBinding,
} from "./binding-types.js";
import { validateBindingFile } from "./binding-types.js";
import { BindingRegistry } from "./binding-registry.js";
import { resolveDependencyPackageRoot } from "./package-roots.js";
import { getClassNameFromPath } from "../resolver/naming.js";
import { getNamespaceFromPath } from "../resolver/namespace.js";
import {
  deriveSourcePackageFallbackNamespace,
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

const isExportedTopLevelStatement = (statement: ts.Statement): boolean =>
  !!(ts.canHaveModifiers(statement)
    ? ts
        .getModifiers(statement)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    : false);

type TopLevelSymbolKind = "class" | "enum" | "function" | "variable";

type TopLevelSymbol = {
  readonly name: string;
  readonly kind: TopLevelSymbolKind;
  readonly node:
    | ts.ClassDeclaration
    | ts.EnumDeclaration
    | ts.FunctionDeclaration
    | ts.VariableDeclaration;
};

type ExportedTopLevelSymbol = {
  readonly exportName: string;
  readonly localName: string;
  readonly kind: TopLevelSymbolKind;
  readonly node:
    | ts.ClassDeclaration
    | ts.EnumDeclaration
    | ts.FunctionDeclaration
    | ts.VariableDeclaration;
};

type SyntheticSourceMember = {
  readonly alias: string;
  readonly kind: "method" | "property";
  readonly parameterCount?: number;
};

const getSourcePackageNamespace = (metadata: SourcePackageMetadata): string =>
  metadata.namespace ??
  deriveSourcePackageFallbackNamespace(metadata.packageName);

const readSourceFile = (
  sourceFilePath: string
): ts.SourceFile | undefined => {
  if (!fs.existsSync(sourceFilePath)) {
    return undefined;
  }

  return ts.createSourceFile(
    sourceFilePath,
    fs.readFileSync(sourceFilePath, "utf-8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
};

type AmbientSourceFile = {
  readonly filePath: string;
  readonly sourceFile: ts.SourceFile;
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

const collectTopLevelSymbols = (
  sourceFile: ts.SourceFile
): ReadonlyMap<string, TopLevelSymbol> => {
  const symbols = new Map<string, TopLevelSymbol>();

  for (const statement of sourceFile.statements) {
    if (
      ts.isClassDeclaration(statement) &&
      statement.name?.text
    ) {
      symbols.set(statement.name.text, {
        name: statement.name.text,
        kind: "class",
        node: statement,
      });
      continue;
    }

    if (
      ts.isEnumDeclaration(statement) &&
      statement.name.text
    ) {
      symbols.set(statement.name.text, {
        name: statement.name.text,
        kind: "enum",
        node: statement,
      });
      continue;
    }

    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text
    ) {
      symbols.set(statement.name.text, {
        name: statement.name.text,
        kind: "function",
        node: statement,
      });
      continue;
    }

    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) {
        continue;
      }

      symbols.set(declaration.name.text, {
        name: declaration.name.text,
        kind: "variable",
        node: declaration,
      });
    }
  }

  return symbols;
};

const collectExportedTopLevelSymbols = (
  sourceFile: ts.SourceFile
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

  for (const statement of sourceFile.statements) {
    if (
      ts.isClassDeclaration(statement) &&
      statement.name?.text &&
      isExportedTopLevelStatement(statement)
    ) {
      pushSymbol(statement.name.text, statement.name.text, topLevel.get(statement.name.text));
      continue;
    }

    if (
      ts.isEnumDeclaration(statement) &&
      statement.name.text &&
      isExportedTopLevelStatement(statement)
    ) {
      pushSymbol(statement.name.text, statement.name.text, topLevel.get(statement.name.text));
      continue;
    }

    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text &&
      isExportedTopLevelStatement(statement)
    ) {
      pushSymbol(statement.name.text, statement.name.text, topLevel.get(statement.name.text));
      continue;
    }

    if (ts.isVariableStatement(statement) && isExportedTopLevelStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          continue;
        }
        pushSymbol(
          declaration.name.text,
          declaration.name.text,
          topLevel.get(declaration.name.text)
        );
      }
      continue;
    }

    if (
      !ts.isExportDeclaration(statement) ||
      !!statement.moduleSpecifier ||
      !statement.exportClause ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      continue;
    }

    for (const element of statement.exportClause.elements) {
      const localName = element.propertyName?.text ?? element.name.text;
      pushSymbol(element.name.text, localName, topLevel.get(localName));
    }
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
  if (kind === "class" || kind === "enum") {
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
  if (kind === "class" || kind === "enum") {
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
      const declaration = symbol.node as ts.FunctionDeclaration;
      members.push({
        alias: symbol.exportName,
        kind: "method",
        parameterCount: declaration.parameters.length,
      });
      continue;
    }

    if (symbol.kind !== "variable") {
      continue;
    }

    const declaration = symbol.node as ts.VariableDeclaration;
    const initializer = declaration.initializer;
    const kind =
      initializer &&
      (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
        ? "method"
        : "property";
    members.push({ alias: symbol.exportName, kind });
  }

  return members;
};

const readClassMemberName = (
  member:
    | ts.ClassElement
    | ts.TypeElement
    | ts.GetAccessorDeclaration
    | ts.SetAccessorDeclaration
): string | undefined => {
  const name = member.name;
  if (!name) {
    return undefined;
  }

  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text;
  }

  return undefined;
};

const collectSyntheticClassMembers = (
  declaration: ts.ClassDeclaration
): readonly SyntheticSourceMember[] => {
  const members: SyntheticSourceMember[] = [];

  for (const member of declaration.members) {
    if (
      ts.isMethodDeclaration(member) &&
      readClassMemberName(member)
    ) {
      members.push({
        alias: readClassMemberName(member)!,
        kind: "method",
        parameterCount: member.parameters.length,
      });
      continue;
    }

    if (
      (ts.isPropertyDeclaration(member) ||
        ts.isGetAccessorDeclaration(member) ||
        ts.isSetAccessorDeclaration(member)) &&
      readClassMemberName(member)
    ) {
      members.push({
        alias: readClassMemberName(member)!,
        kind: "property",
      });
    }
  }

  return members;
};

const getAmbientGlobalStatements = (
  sourceFile: ts.SourceFile
): readonly ts.Statement[] => {
  const declareGlobalStatements = sourceFile.statements.flatMap((statement) => {
    if (
      ts.isModuleDeclaration(statement) &&
      ts.isIdentifier(statement.name) &&
      statement.name.text === "global" &&
      statement.body &&
      ts.isModuleBlock(statement.body)
    ) {
      return [...statement.body.statements];
    }
    return [];
  });

  return declareGlobalStatements.length > 0
    ? declareGlobalStatements
    : [...sourceFile.statements];
};

const collectSyntheticInterfaceMembers = (
  sourceFile: ts.SourceFile,
  interfaceName: string
): readonly SyntheticSourceMember[] => {
  const declaration = getAmbientGlobalStatements(sourceFile).find(
    (statement): statement is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(statement) &&
      statement.name.text === interfaceName
  );
  if (!declaration) {
    return [];
  }

  const members: SyntheticSourceMember[] = [];
  for (const member of declaration.members) {
    if (
      (ts.isPropertySignature(member) ||
        ts.isGetAccessorDeclaration(member) ||
        ts.isSetAccessorDeclaration(member)) &&
      readClassMemberName(member)
    ) {
      members.push({
        alias: readClassMemberName(member)!,
        kind: "property",
      });
      continue;
    }

    if (
      (ts.isMethodSignature(member) || ts.isMethodDeclaration(member)) &&
      readClassMemberName(member)
    ) {
      members.push({
        alias: readClassMemberName(member)!,
        kind: "method",
        parameterCount: member.parameters.length,
      });
    }
  }

  return members;
};

const createSyntheticJsArrayTypeBindings = (
  metadata: SourcePackageMetadata
): readonly TypeBinding[] => {
  if (metadata.packageName !== "@tsonic/js") {
    return [];
  }

  const ambientSources = readAmbientSourceFiles(metadata);
  if (ambientSources.length === 0) {
    return [];
  }

  const buildBinding = (
    alias: string,
    interfaceName: string
  ): TypeBinding | undefined => {
    const members = ambientSources.flatMap(({ sourceFile }) =>
      collectSyntheticInterfaceMembers(sourceFile, interfaceName)
    );
    if (members.length === 0) {
      return undefined;
    }

    return {
      name: "Tsonic.Runtime.JSArray`1",
      alias,
      kind: "interface",
      members: members.map((member): MemberBinding => ({
        kind: member.kind,
        name: member.alias,
        alias: member.alias,
        parameterCount: member.parameterCount,
        binding: {
          assembly: "Tsonic.Runtime",
          type: "Tsonic.Runtime.JSArray`1",
          member: member.alias,
        },
      })),
    };
  };

  const bindings = [
    buildBinding("JSArray", "Array"),
    buildBinding("Array", "Array"),
    buildBinding("ReadonlyArray", "ReadonlyArray"),
    buildBinding("ArrayLike", "ArrayLike"),
  ].filter((binding): binding is TypeBinding => binding !== undefined);

  return bindings;
};

const createSyntheticWrapperType = (
  metadata: SourcePackageMetadata,
  typeAlias: string
): TypeBinding | undefined => {
  const sourceFilePath = path.join(metadata.sourceRoot, `${typeAlias}.ts`);
  const ownerType = resolveTopLevelBindingHostType(
    sourceFilePath,
    metadata,
    getClassNameFromPath(sourceFilePath),
    "function"
  );
  const members = collectSyntheticSourceMembers(sourceFilePath);
  if (members.length === 0) {
    return undefined;
  }

  return {
    name: ownerType,
    alias: typeAlias,
    kind: "class",
    members: members.map((member): MemberBinding => ({
      kind: member.kind,
      name: member.alias,
      alias: member.alias,
      parameterCount: member.parameterCount,
      binding: {
        assembly: getSourcePackageNamespace(metadata),
        type: ownerType,
        member: member.alias,
      },
      isExtensionMethod: member.kind === "method",
      emitSemantics:
        member.kind === "method"
          ? {
              callStyle: "static",
            }
          : undefined,
    })),
  };
};

const createSyntheticSourceTypeBindings = (
  metadata: SourcePackageMetadata
): readonly TypeBinding[] => {
  const types: TypeBinding[] = [
    ...createSyntheticJsArrayTypeBindings(metadata),
  ];
  const usedAliases = new Set<string>();

  for (const wrapperAlias of ["String", "Number", "Boolean"]) {
    const wrapper = createSyntheticWrapperType(metadata, wrapperAlias);
    if (!wrapper) {
      continue;
    }
    types.push(wrapper);
    usedAliases.add(wrapper.alias);
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
          symbol.kind === "class" && ts.isClassDeclaration(symbol.node)
            ? collectSyntheticClassMembers(symbol.node).map(
                (member): MemberBinding => ({
                  kind: member.kind,
                  name: member.alias,
                  alias: member.alias,
                  parameterCount: member.parameterCount,
                  binding: {
                    assembly: getSourcePackageNamespace(metadata),
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
    .filter(([, target]) => path.resolve(metadata.packageRoot, target) === normalizedFilePath)
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
): { readonly ownerType: string; readonly sourceImport: string } | undefined => {
  const candidatePaths = [...metadata.exportPaths].sort((left, right) => {
    const leftBase = path.basename(left, path.extname(left)).toLowerCase();
    const rightBase = path.basename(right, path.extname(right)).toLowerCase();
    const target = exportName.toLowerCase();
    const leftRank = leftBase === target ? 0 : leftBase.includes(target) ? 1 : 2;
    const rightRank = rightBase === target ? 0 : rightBase.includes(target) ? 1 : 2;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.localeCompare(right);
  });

  for (const sourceFilePath of candidatePaths) {
    const ownerType = resolveExportOwnerType(sourceFilePath, exportName, metadata);
    const sourceImport = resolveSourceImportSpecifier(metadata, sourceFilePath);
    if (!ownerType || !sourceImport) {
      continue;
    }
    return { ownerType, sourceImport };
  }

  return undefined;
};

const extractImportTypeTarget = (
  declaration: ts.VariableDeclaration
): { readonly specifier: string; readonly exportName: string } | undefined => {
  const typeNode = declaration.type;
  if (!typeNode || !ts.isImportTypeNode(typeNode) || !typeNode.isTypeOf) {
    return undefined;
  }

  const literal =
    ts.isLiteralTypeNode(typeNode.argument) &&
    ts.isStringLiteral(typeNode.argument.literal)
      ? typeNode.argument.literal
      : undefined;
  if (!literal || !typeNode.qualifier) {
    return undefined;
  }

  const exportName = typeNode.qualifier.getText().trim();
  if (exportName.length === 0) {
    return undefined;
  }

  return {
    specifier: literal.text,
    exportName,
  };
};

const collectSyntheticSourceGlobals = (
  metadata: SourcePackageMetadata
): SimpleBindingFile | undefined => {
  const ambientSources = readAmbientSourceFiles(metadata);
  if (ambientSources.length === 0) {
    return undefined;
  }

  const bindings: Record<string, SimpleBindingDescriptor> = {};
  const sourceNamespace = getSourcePackageNamespace(metadata);

  const bindGlobalName = (globalName: string): void => {
    let ownerType: string | undefined;
    let sourceImport: string | undefined;

    if (globalName !== "Number") {
      const inferred = resolveGlobalOwnerByExportName(metadata, globalName);
      ownerType = inferred?.ownerType;
      sourceImport = inferred?.sourceImport;
    }

    if (!ownerType || !sourceImport) {
      return;
    }

    bindings[globalName] = {
      kind: "global",
      assembly: sourceNamespace,
      type: ownerType,
      staticType: ownerType,
      sourceImport,
    };
  };

  for (const { filePath, sourceFile } of ambientSources) {
    for (const globalStatement of getAmbientGlobalStatements(sourceFile)) {
      if (ts.isVariableStatement(globalStatement)) {
        for (const declaration of globalStatement.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name)) {
            continue;
          }

          const importTarget = extractImportTypeTarget(declaration);
          let ownerType: string | undefined;
          let sourceImport: string | undefined;

          if (importTarget) {
            const sourceFilePath = resolveSourceImportFilePath(
              filePath,
              importTarget.specifier
            );
            if (!sourceFilePath) {
              continue;
            }

            ownerType = resolveExportOwnerType(
              sourceFilePath,
              importTarget.exportName,
              metadata
            );
            sourceImport = resolveSourceImportSpecifier(metadata, sourceFilePath);
          } else if (declaration.name.text !== "Number") {
            const inferred = resolveGlobalOwnerByExportName(
              metadata,
              declaration.name.text
            );
            ownerType = inferred?.ownerType;
            sourceImport = inferred?.sourceImport;
          }

          if (!ownerType || !sourceImport) {
            continue;
          }

          bindings[declaration.name.text] = {
            kind: "global",
            assembly: sourceNamespace,
            type: ownerType,
            staticType: ownerType,
            sourceImport,
          };
        }
        continue;
      }

      if (
        ts.isFunctionDeclaration(globalStatement) &&
        globalStatement.name?.text
      ) {
        bindGlobalName(globalStatement.name.text);
        continue;
      }

      if (
        ts.isClassDeclaration(globalStatement) &&
        globalStatement.name?.text
      ) {
        bindGlobalName(globalStatement.name.text);
        continue;
      }

      if (ts.isEnumDeclaration(globalStatement)) {
        bindGlobalName(globalStatement.name.text);
        continue;
      }

      if (ts.isVariableDeclaration(globalStatement)) {
        if (ts.isIdentifier(globalStatement.name)) {
          bindGlobalName(globalStatement.name.text);
        }
        continue;
      }

      if (ts.isModuleDeclaration(globalStatement)) {
        const body = globalStatement.body;
        if (!body || !ts.isModuleBlock(body)) {
          continue;
        }
        for (const nested of body.statements) {
          if (ts.isFunctionDeclaration(nested) && nested.name?.text) {
            bindGlobalName(nested.name.text);
          }
        }
      }
    }
  }

  if (
    metadata.packageName === "@tsonic/js" &&
    !bindings.Number
  ) {
    const numberFunctionOwner = resolveExportOwnerType(
      path.join(metadata.sourceRoot, "Globals.ts"),
      "Number",
      metadata
    );
    const numberStaticOwner = resolveExportOwnerType(
      path.join(metadata.sourceRoot, "number-object.ts"),
      "Number",
      metadata
    );

    if (numberFunctionOwner && numberStaticOwner) {
      bindings.Number = {
        kind: "global",
        assembly: sourceNamespace,
        type: numberFunctionOwner,
        staticType: numberStaticOwner,
        sourceImport: `${metadata.packageName}/index.js`,
      };
    }
  }

  return Object.keys(bindings).length > 0 ? { bindings } : undefined;
};

const addSyntheticSourcePackageBindings = (
  registry: BindingRegistry,
  metadata: SourcePackageMetadata
): void => {
  const sourceNamespace = getSourcePackageNamespace(metadata);
  const syntheticTypes = createSyntheticSourceTypeBindings(metadata);
  if (syntheticTypes.length > 0) {
    const manifest: FullBindingManifest = {
      assembly: sourceNamespace,
      namespaces: [
        {
          name: sourceNamespace,
          alias: sourceNamespace,
          types: syntheticTypes,
        },
      ],
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

/**
 * Load bindings from a package directory and recursively from its dependencies.
 *
 * This supports the common "namespace facade" layout:
 * - `System.d.ts` (or `index.d.ts`) at the package root
 * - `System/bindings.json` (or `index/bindings.json`) next to the namespace's `internal/index.d.ts`
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
    // e.g., "System.d.ts" → "System"
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

      for (const depName of dependencyNames) {
        const dependencyRoot = resolveDependencyPackageRoot(
          absoluteRoot,
          depName
        );
        if (dependencyRoot) {
          loadBindingsFromPackage(registry, dependencyRoot, visited, false);
        }
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

  for (const typeRoot of typeRoots) {
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
 * Load all CLR bindings discovered by the resolver.
 * This should be called AFTER createProgram but BEFORE IR building
 * to ensure all bindings are available during IR construction.
 *
 * Note: The ClrBindingsResolver tracks discovered binding paths via caching,
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
