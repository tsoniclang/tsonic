import type { GoPtr } from "../go/compat.js";
import type { Node, NodeList } from "../internal/ast/spine.js";
import type { SourceFile } from "../internal/ast/ast.js";
import {
  Node_Elements,
  Node_Expression,
  Node_Initializer,
  Node_ModifierFlags,
  Node_ModuleSpecifier,
  Node_Text,
  SourceFile_FileName,
  SourceFile_Path,
  SourceFile_Text,
} from "../internal/ast/ast.js";
import { Node_Name } from "../internal/ast/spine.js";
import { NewHasFileName } from "../internal/ast/utilities.js";
import {
  AsExportAssignment,
  AsExportDeclaration,
  AsExportSpecifier,
  AsNamedExports,
  AsNamespaceExport,
  AsStringLiteral,
  AsVariableDeclarationList,
  AsVariableStatement,
} from "../internal/ast/generated/casts.js";
import {
  KindBigIntLiteral,
  KindFalseKeyword,
  KindNoSubstitutionTemplateLiteral,
  KindNullKeyword,
  KindNumericLiteral,
  KindRegularExpressionLiteral,
  KindStringLiteral,
  KindTrueKeyword,
} from "../internal/ast/generated/kinds.js";
import {
  IsClassDeclaration,
  IsEnumDeclaration,
  IsExportAssignment,
  IsExportDeclaration,
  IsFunctionDeclaration,
  IsImportDeclaration,
  IsInterfaceDeclaration,
  IsModuleDeclaration,
  IsNamedExports,
  IsNamespaceExport,
  IsTypeAliasDeclaration,
  IsVariableStatement,
} from "../internal/ast/generated/predicates.js";
import { ModifierFlagsDefault, ModifierFlagsExport } from "../internal/ast/modifierflags.js";
import type { Program } from "../internal/compiler/program.js";
import { Program_GetResolvedModuleFromModuleSpecifier } from "../internal/compiler/program.js";
import type { ResolvedModule } from "../internal/module/types.js";
import { ResolvedModule_IsResolved } from "../internal/module/types.js";
import {
  createExtensionImportIndex,
  type ExtensionImportBinding,
  type ExtensionImportModule,
} from "./import-index.js";

export type ExtensionResolvedModule = {
  readonly resolvedFileName: string;
  readonly originalPath: string;
  readonly extension: string;
  readonly packageName?: string | undefined;
  readonly packageSubmoduleName?: string | undefined;
  readonly packageVersion?: string | undefined;
  readonly isExternalLibraryImport: boolean;
};

export type ExtensionExportBindingKind =
  | "named"
  | "default"
  | "namespace"
  | "star"
  | "export-equals";

export type ExtensionExportBinding = {
  readonly kind: ExtensionExportBindingKind;
  readonly exportedName?: string | undefined;
  readonly localName?: string | undefined;
  readonly sourceSpecifier?: string | undefined;
  readonly isTypeOnly: boolean;
  readonly exportNode: GoPtr<Node>;
  readonly bindingNode: GoPtr<Node>;
  readonly resolvedModule?: ExtensionResolvedModule | undefined;
};

export type ExtensionModuleImport = ExtensionImportModule & {
  readonly resolvedModule?: ExtensionResolvedModule | undefined;
};

export type ExtensionSourceModule = {
  readonly sourceFile: GoPtr<SourceFile>;
  readonly fileName: string;
  readonly text: string;
  readonly imports: readonly ExtensionModuleImport[];
  readonly exports: readonly ExtensionExportBinding[];
  readonly hasTopLevelCode: boolean;
};

export type ExtensionModuleGraph = {
  readonly modules: readonly ExtensionSourceModule[];
  getSourceFileModule(sourceFile: GoPtr<SourceFile>): ExtensionSourceModule | undefined;
  getImports(sourceFile: GoPtr<SourceFile>): readonly ExtensionModuleImport[];
  getExports(sourceFile: GoPtr<SourceFile>): readonly ExtensionExportBinding[];
  getResolvedModule(
    sourceFile: GoPtr<SourceFile>,
    specifier: string,
  ): ExtensionResolvedModule | undefined;
  getImportBinding(
    sourceFile: GoPtr<SourceFile>,
    localName: string,
  ): ExtensionImportBinding | undefined;
  getExportBinding(
    sourceFile: GoPtr<SourceFile>,
    exportedName: string,
  ): ExtensionExportBinding | undefined;
};

const nodesOf = (list: GoPtr<NodeList>): readonly GoPtr<Node>[] => list?.Nodes ?? [];

const isLiteralExpression = (node: GoPtr<Node>): boolean => {
  switch (node?.Kind) {
    case KindBigIntLiteral:
    case KindFalseKeyword:
    case KindNoSubstitutionTemplateLiteral:
    case KindNullKeyword:
    case KindNumericLiteral:
    case KindRegularExpressionLiteral:
    case KindStringLiteral:
    case KindTrueKeyword:
      return true;
    default:
      return false;
  }
};

const nodeText = (node: GoPtr<Node>): string | undefined => {
  const text = node === undefined ? "" : Node_Text(node);
  return text === "" ? undefined : text;
};

const sourceFileKey = (sourceFile: GoPtr<SourceFile>): string =>
  sourceFile === undefined ? "" : SourceFile_FileName(sourceFile);

const toResolvedModule = (
  resolvedModule: GoPtr<ResolvedModule>,
): ExtensionResolvedModule | undefined => {
  if (resolvedModule === undefined || !ResolvedModule_IsResolved(resolvedModule)) {
    return undefined;
  }
  const packageId = resolvedModule.PackageId;
  return {
    resolvedFileName: resolvedModule.ResolvedFileName,
    originalPath: resolvedModule.OriginalPath,
    extension: resolvedModule.Extension,
    packageName: packageId.Name === "" ? undefined : packageId.Name,
    packageSubmoduleName:
      packageId.SubModuleName === "" ? undefined : packageId.SubModuleName,
    packageVersion: packageId.Version === "" ? undefined : packageId.Version,
    isExternalLibraryImport: resolvedModule.IsExternalLibraryImport === true,
  };
};

const resolveModuleSpecifier = (
  program: GoPtr<Program>,
  sourceFile: GoPtr<SourceFile>,
  moduleSpecifier: GoPtr<Node>,
): ExtensionResolvedModule | undefined => {
  if (!program || !sourceFile || !moduleSpecifier) {
    return undefined;
  }
  const stringLiteral = AsStringLiteral(moduleSpecifier);
  if (!stringLiteral) {
    return undefined;
  }
  return toResolvedModule(
    Program_GetResolvedModuleFromModuleSpecifier(
      program,
      NewHasFileName(SourceFile_FileName(sourceFile), SourceFile_Path(sourceFile)),
      stringLiteral,
    ),
  );
};

const resolvedImportModules = (
  program: GoPtr<Program>,
  sourceFile: GoPtr<SourceFile>,
): readonly ExtensionModuleImport[] => {
  const importIndex = createExtensionImportIndex(sourceFile);
  return importIndex.modules.map((module): ExtensionModuleImport => ({
    ...module,
    resolvedModule: resolveModuleSpecifier(program, sourceFile, Node_ModuleSpecifier(module.importNode)),
  }));
};

const pushNamedExportSpecifiers = (
  exports: ExtensionExportBinding[],
  sourceFile: GoPtr<SourceFile>,
  program: GoPtr<Program>,
  exportNode: GoPtr<Node>,
  exportClause: GoPtr<Node>,
  moduleSpecifier: GoPtr<Node>,
  declarationIsTypeOnly: boolean,
): void => {
  const namedExports = AsNamedExports(exportClause);
  for (const specifierNode of nodesOf(namedExports?.Elements)) {
    const specifier = AsExportSpecifier(specifierNode);
    if (!specifier) {
      continue;
    }
    const exportedName = nodeText(specifier.name);
    const localName = nodeText(specifier.PropertyName) ?? exportedName;
    if (!exportedName) {
      continue;
    }
    exports.push({
      kind: "named",
      exportedName,
      localName,
      sourceSpecifier: nodeText(moduleSpecifier),
      isTypeOnly: declarationIsTypeOnly || specifier.IsTypeOnly === true,
      exportNode,
      bindingNode: specifierNode,
      resolvedModule: resolveModuleSpecifier(program, sourceFile, moduleSpecifier),
    });
  }
};

const pushExportDeclaration = (
  exports: ExtensionExportBinding[],
  sourceFile: GoPtr<SourceFile>,
  program: GoPtr<Program>,
  exportNode: GoPtr<Node>,
): void => {
  const declaration = AsExportDeclaration(exportNode);
  if (!declaration) {
    return;
  }
  const moduleSpecifier = declaration.ModuleSpecifier;
  const exportClause = declaration.ExportClause;
  if (!exportClause) {
    exports.push({
      kind: "star",
      sourceSpecifier: nodeText(moduleSpecifier),
      isTypeOnly: declaration.IsTypeOnly === true,
      exportNode,
      bindingNode: exportNode,
      resolvedModule: resolveModuleSpecifier(program, sourceFile, moduleSpecifier),
    });
    return;
  }

  if (IsNamedExports(exportClause)) {
    pushNamedExportSpecifiers(
      exports,
      sourceFile,
      program,
      exportNode,
      exportClause,
      moduleSpecifier,
      declaration.IsTypeOnly === true,
    );
    return;
  }

  if (IsNamespaceExport(exportClause)) {
    const namespaceExport = AsNamespaceExport(exportClause);
    const exportedName = nodeText(namespaceExport?.name);
    exports.push({
      kind: "namespace",
      exportedName,
      sourceSpecifier: nodeText(moduleSpecifier),
      isTypeOnly: declaration.IsTypeOnly === true,
      exportNode,
      bindingNode: exportClause,
      resolvedModule: resolveModuleSpecifier(program, sourceFile, moduleSpecifier),
    });
  }
};

const pushExportAssignment = (
  exports: ExtensionExportBinding[],
  exportNode: GoPtr<Node>,
): void => {
  const assignment = AsExportAssignment(exportNode);
  if (!assignment) {
    return;
  }
  exports.push({
    kind: assignment.IsExportEquals === true ? "export-equals" : "default",
    localName: nodeText(Node_Expression(exportNode)),
    isTypeOnly: false,
    exportNode,
    bindingNode: Node_Expression(exportNode),
  });
};

const pushExportedVariables = (
  exports: ExtensionExportBinding[],
  statement: GoPtr<Node>,
  isDefault: boolean,
): void => {
  const declarationList = AsVariableStatement(statement)?.DeclarationList;
  const declarations = AsVariableDeclarationList(declarationList)?.Declarations;
  for (const declaration of nodesOf(declarations)) {
    const localName = nodeText(Node_Name(declaration));
    if (!localName) {
      continue;
    }
    exports.push({
      kind: isDefault ? "default" : "named",
      exportedName: isDefault ? "default" : localName,
      localName,
      isTypeOnly: false,
      exportNode: statement,
      bindingNode: declaration,
    });
  }
};

const hasExecutableInitializer = (node: GoPtr<Node>): boolean => {
  const declarationList = AsVariableStatement(node)?.DeclarationList;
  const declarations = AsVariableDeclarationList(declarationList)?.Declarations;
  return nodesOf(declarations).some((declaration) => {
    const initializer = Node_Initializer(declaration);
    return initializer !== undefined && !isLiteralExpression(initializer);
  });
};

const isTopLevelCode = (node: GoPtr<Node>): boolean => {
  if (IsModuleDeclaration(node)) return false;
  if (IsImportDeclaration(node)) return false;
  if (IsExportDeclaration(node)) return false;
  if (IsExportAssignment(node)) return false;
  if (IsTypeAliasDeclaration(node)) return false;
  if (IsInterfaceDeclaration(node)) return false;
  if (IsFunctionDeclaration(node)) return false;
  if (IsClassDeclaration(node)) return false;
  if (IsEnumDeclaration(node)) return false;
  if (IsVariableStatement(node)) return hasExecutableInitializer(node);
  return true;
};

const pushExportedDeclaration = (
  exports: ExtensionExportBinding[],
  statement: GoPtr<Node>,
): void => {
  const modifiers = Node_ModifierFlags(statement);
  if ((modifiers & ModifierFlagsExport) === 0) {
    return;
  }
  const isDefault = (modifiers & ModifierFlagsDefault) !== 0;
  if (IsVariableStatement(statement)) {
    pushExportedVariables(exports, statement, isDefault);
    return;
  }
  if (
    IsFunctionDeclaration(statement) ||
    IsClassDeclaration(statement) ||
    IsInterfaceDeclaration(statement) ||
    IsTypeAliasDeclaration(statement) ||
    IsEnumDeclaration(statement) ||
    IsModuleDeclaration(statement)
  ) {
    const localName = nodeText(Node_Name(statement));
    exports.push({
      kind: isDefault ? "default" : "named",
      exportedName: isDefault ? "default" : localName,
      localName,
      isTypeOnly:
        IsInterfaceDeclaration(statement) || IsTypeAliasDeclaration(statement),
      exportNode: statement,
      bindingNode: Node_Name(statement),
    });
  }
};

const collectExports = (
  program: GoPtr<Program>,
  sourceFile: GoPtr<SourceFile>,
): readonly ExtensionExportBinding[] => {
  const exports: ExtensionExportBinding[] = [];
  for (const statement of nodesOf(sourceFile?.Statements)) {
    if (IsExportDeclaration(statement)) {
      pushExportDeclaration(exports, sourceFile, program, statement);
      continue;
    }
    if (IsExportAssignment(statement)) {
      pushExportAssignment(exports, statement);
      continue;
    }
    pushExportedDeclaration(exports, statement);
  }
  return exports;
};

export const createExtensionModuleGraph = (
  program: GoPtr<Program>,
  sourceFiles: readonly GoPtr<SourceFile>[],
): ExtensionModuleGraph => {
  const modules = sourceFiles
    .filter((sourceFile): sourceFile is SourceFile => sourceFile !== undefined)
    .map((sourceFile): ExtensionSourceModule => ({
      sourceFile,
      fileName: SourceFile_FileName(sourceFile),
      text: SourceFile_Text(sourceFile),
      imports: resolvedImportModules(program, sourceFile),
      exports: collectExports(program, sourceFile),
      hasTopLevelCode: nodesOf(sourceFile.Statements).some(isTopLevelCode),
    }));
  const byFileName = new Map(modules.map((module) => [module.fileName, module]));

  const getSourceFileModule = (
    sourceFile: GoPtr<SourceFile>,
  ): ExtensionSourceModule | undefined => byFileName.get(sourceFileKey(sourceFile));

  return {
    modules,
    getSourceFileModule,
    getImports: (sourceFile: GoPtr<SourceFile>): readonly ExtensionModuleImport[] =>
      getSourceFileModule(sourceFile)?.imports ?? [],
    getExports: (sourceFile: GoPtr<SourceFile>): readonly ExtensionExportBinding[] =>
      getSourceFileModule(sourceFile)?.exports ?? [],
    getResolvedModule: (
      sourceFile: GoPtr<SourceFile>,
      specifier: string,
    ): ExtensionResolvedModule | undefined =>
      getSourceFileModule(sourceFile)?.imports.find(
        (module) => module.specifier === specifier,
      )?.resolvedModule ??
      getSourceFileModule(sourceFile)?.exports.find(
        (binding) => binding.sourceSpecifier === specifier,
      )?.resolvedModule,
    getImportBinding: (
      sourceFile: GoPtr<SourceFile>,
      localName: string,
    ): ExtensionImportBinding | undefined =>
      getSourceFileModule(sourceFile)
        ?.imports.flatMap((module) => module.bindings)
        .find((binding) => binding.localName === localName),
    getExportBinding: (
      sourceFile: GoPtr<SourceFile>,
      exportedName: string,
    ): ExtensionExportBinding | undefined =>
      getSourceFileModule(sourceFile)?.exports.find(
        (binding) => binding.exportedName === exportedName,
      ),
  };
};
