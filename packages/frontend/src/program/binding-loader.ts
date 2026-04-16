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

type TopLevelSymbolKind =
  | "class"
  | "enum"
  | "function"
  | "interface"
  | "variable";

type TopLevelSymbol = {
  readonly name: string;
  readonly kind: TopLevelSymbolKind;
  readonly node:
    | ts.ClassDeclaration
    | ts.EnumDeclaration
    | ts.FunctionDeclaration
    | ts.InterfaceDeclaration
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
    | ts.InterfaceDeclaration
    | ts.VariableDeclaration;
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

    if (
      ts.isInterfaceDeclaration(statement) &&
      statement.name.text
    ) {
      symbols.set(statement.name.text, {
        name: statement.name.text,
        kind: "interface",
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

    if (
      ts.isInterfaceDeclaration(statement) &&
      statement.name.text &&
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
    if (
      initializer &&
      (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
    ) {
      members.push({
        alias: symbol.exportName,
        kind: "method",
        parameterCount: initializer.parameters.length,
      });
      continue;
    }

    members.push({ alias: symbol.exportName, kind: "property" });
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
  declaration: ts.ClassDeclaration,
  scope: SyntheticClassMemberScope
): readonly SyntheticSourceMember[] => {
  const members: SyntheticSourceMember[] = [];

  const matchesScope = (member: ts.ClassElement): boolean => {
    const isStatic =
      ts.canHaveModifiers(member) &&
      ts.getModifiers(member)?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword
      ) === true;
    return scope === "static" ? isStatic : !isStatic;
  };

  const isPubliclyAccessible = (member: ts.ClassElement): boolean => {
    if (!ts.canHaveModifiers(member)) {
      return true;
    }

    return !(
      ts.getModifiers(member)?.some(
        (modifier) =>
          modifier.kind === ts.SyntaxKind.PrivateKeyword ||
          modifier.kind === ts.SyntaxKind.ProtectedKeyword
      ) ?? false
    );
  };

  for (const member of declaration.members) {
    if (!matchesScope(member) || !isPubliclyAccessible(member)) {
      continue;
    }

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

const collectSyntheticInterfaceMembers = (
  declaration: ts.InterfaceDeclaration
): readonly SyntheticSourceMember[] => {
  const members: SyntheticSourceMember[] = [];

  for (const member of declaration.members) {
    if (
      ts.isMethodSignature(member) &&
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
      ts.isPropertySignature(member) &&
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

const findImportedTypeTarget = (
  sourceFile: ts.SourceFile,
  localName: string
): { readonly specifier: string; readonly exportName: string } | undefined => {
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !statement.importClause ||
      !statement.moduleSpecifier ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }

    const namedBindings = statement.importClause.namedBindings;
    if (!namedBindings || !ts.isNamedImports(namedBindings)) {
      continue;
    }

    for (const element of namedBindings.elements) {
      if (element.name.text !== localName) {
        continue;
      }

      return {
        specifier: statement.moduleSpecifier.text,
        exportName: element.propertyName?.text ?? element.name.text,
      };
    }
  }

  return undefined;
};

const hasExportedTypeLikeSymbol = (
  sourceFile: ts.SourceFile,
  exportName: string
): boolean => {
  for (const statement of sourceFile.statements) {
    if (
      (ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement) ||
        ts.isFunctionDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement)) &&
      statement.name?.text === exportName &&
      isExportedTopLevelStatement(statement)
    ) {
      return true;
    }

    if (ts.isVariableStatement(statement)) {
      if (!isExportedTopLevelStatement(statement)) {
        continue;
      }

      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === exportName
        ) {
          return true;
        }
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
      const local = element.propertyName?.text ?? element.name.text;
      if (element.name.text === exportName || local === exportName) {
        return true;
      }
    }
  }

  return false;
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
    const classDeclaration = exportedSymbol.node as ts.ClassDeclaration;
    const instanceMembers = collectSyntheticClassMembers(
      classDeclaration,
      "instance"
    );
    if (instanceMembers.length > 0) {
      return instanceMembers;
    }

    return collectSyntheticClassMembers(classDeclaration, "static")
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
    return collectSyntheticInterfaceMembers(
      exportedSymbol.node as ts.InterfaceDeclaration
    );
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
  declaration: ts.InterfaceDeclaration
): readonly AmbientInterfaceSourceOwner[] => {
  const owners: AmbientInterfaceSourceOwner[] = [];
  const seen = new Set<string>();

  for (const heritageClause of declaration.heritageClauses ?? []) {
    if (heritageClause.token !== ts.SyntaxKind.ExtendsKeyword) {
      continue;
    }

    for (const heritageType of heritageClause.types) {
      if (!ts.isIdentifier(heritageType.expression)) {
        continue;
      }

      const target = findImportedTypeTarget(
        declaration.getSourceFile(),
        heritageType.expression.text
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
      if (!sourceFile || !hasExportedTypeLikeSymbol(sourceFile, target.exportName)) {
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
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        declaration.name.text !== interfaceName
      ) {
        continue;
      }

      for (const target of extractImportTypeTargets(declaration)) {
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
    const classDeclaration = exportedSymbol.node as ts.ClassDeclaration;
    const instanceMembers = collectSyntheticClassMembers(
      classDeclaration,
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
        classDeclaration,
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
      exportedSymbol.node as ts.InterfaceDeclaration
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
  sourceFile: ts.SourceFile
): ReadonlySet<string> => {
  const names = new Set<string>();

  for (const statement of getAmbientGlobalStatements(sourceFile)) {
    if (
      (ts.isInterfaceDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement)) &&
      statement.name
    ) {
      names.add(statement.name.text);
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
      if (!ts.isInterfaceDeclaration(statement) || !statement.name.text) {
        continue;
      }

      const declaredMembers = collectSyntheticInterfaceMembers(statement);

      const ownerTargets =
        resolveAmbientInterfaceExplicitOwners(metadata, statement.name.text);
      const explicitOrHeritageOwners =
        ownerTargets.length > 0
          ? ownerTargets
          : resolveAmbientInterfaceSourceOwners(filePath, statement);
      const resolvedOwnerTargets =
        explicitOrHeritageOwners.length > 0
          ? explicitOrHeritageOwners
          : resolveAmbientInterfaceValueOwners(filePath, statement.name.text);

      const alias = statement.name.text;
      const existing =
        bindings.get(alias) ?? {
          name: `${sourceNamespace}.${alias}`,
          alias,
          kind: "interface" as const,
          members: [],
        };
      const existingMembers = [...existing.members];
      const seenMembers = new Set(
        existingMembers.map((member) => `${member.alias}::${member.binding.type}`)
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
              assembly: sourceNamespace,
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
              assembly: sourceNamespace,
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
          exportedSymbol.node as ts.ClassDeclaration,
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
      sourceOrigin: {
        filePath: sourceFilePath,
        exportName: exportedSymbol?.kind === "class" ? typeAlias : member.alias,
        memberName: exportedSymbol?.kind === "class" ? member.alias : undefined,
      },
    })),
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
          symbol.kind === "class" && ts.isClassDeclaration(symbol.node)
            ? collectSyntheticClassMembers(symbol.node, "static").map(
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

const extractImportTypeTargetFromTypeNode = (
  typeNode: ts.TypeNode,
  declaration: ts.VariableDeclaration
): { readonly specifier: string; readonly exportName: string } | undefined => {
  if (ts.isImportTypeNode(typeNode) && typeNode.isTypeOf) {
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
  }

  if (!ts.isTypeQueryNode(typeNode)) {
    return undefined;
  }

  const exprName = typeNode.exprName;
  const rootIdentifier = ts.isIdentifier(exprName)
    ? exprName
    : ts.isQualifiedName(exprName)
      ? exprName.left
      : undefined;
  if (!rootIdentifier || !ts.isIdentifier(rootIdentifier)) {
    return undefined;
  }

  const sourceFile = declaration.getSourceFile();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !statement.importClause ||
      !statement.moduleSpecifier ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }

    const namedBindings = statement.importClause.namedBindings;
    if (
      namedBindings &&
      ts.isNamedImports(namedBindings)
    ) {
      for (const element of namedBindings.elements) {
        if (element.name.text !== rootIdentifier.text) {
          continue;
        }

        return {
          specifier: statement.moduleSpecifier.text,
          exportName: element.propertyName?.text ?? element.name.text,
        };
      }
    }
  }

  return undefined;
};

const extractImportTypeTargets = (
  declaration: ts.VariableDeclaration
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

  const visitTypeNode = (node: ts.TypeNode | undefined): void => {
    if (!node) {
      return;
    }

    if (ts.isIntersectionTypeNode(node)) {
      for (const member of node.types) {
        visitTypeNode(member);
      }
      return;
    }

    if (ts.isParenthesizedTypeNode(node)) {
      visitTypeNode(node.type);
      return;
    }

    if (ts.isImportTypeNode(node) || ts.isTypeQueryNode(node)) {
      pushTarget(extractImportTypeTargetFromTypeNode(node, declaration));
    }
  };

  visitTypeNode(declaration.type);
  return targets;
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
      assembly: sourceNamespace,
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
      if (ts.isVariableStatement(globalStatement)) {
        for (const declaration of globalStatement.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name)) {
            continue;
          }

          const explicitTargets = extractImportTypeTargets(declaration);
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

            const uniqueSourceImports = [...new Set(resolvedOwners.map((entry) => entry.sourceImport))];
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
              declaration.name.text
            );
            ownerType = inferred?.ownerType;
            staticType = inferred?.ownerType;
            sourceImport = inferred?.sourceImport;
          }

          if (!ownerType || !staticType || !sourceImport) {
            continue;
          }

          bindings[declaration.name.text] = {
            kind: "global",
            assembly: sourceNamespace,
            type: ownerType,
            staticType,
            sourceImport,
            ...(getTypeSemantics(declaration.name.text)
              ? { typeSemantics: getTypeSemantics(declaration.name.text) }
              : {}),
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

const preserveBindingPackageRootOrder = (
  packageRoots: readonly string[]
): readonly string[] => [...packageRoots];

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
