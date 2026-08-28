import type {
  AstReader,
  CheckedSourceProgram,
  Node,
  SourceFile,
  TypeCheckerQueries,
} from "@tsonic/tsts";
import {
  getStaticModuleReference,
} from "../module-reference.js";
import {
  sourceFileIdentity,
} from "./identity.js";
import type {
  SourceProjectModuleDependency,
  SourceProjectModuleExport,
  SourceProjectModuleSpecifierResolution,
} from "./types.js";
import {
  aliasedSymbol,
  primaryDeclaration,
} from "./syntax.js";

export function sourceProjectModuleExports(
  source: CheckedSourceProgram,
  sourceFile: SourceFile,
): readonly SourceProjectModuleExport[] {
  const checker = source.getSourceFileQueries(sourceFile).checker;
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (moduleSymbol === undefined) {
    return Object.freeze([]);
  }
  const moduleExports: SourceProjectModuleExport[] = [];
  for (const exportedSymbol of checker.getExportsOfModule(moduleSymbol)) {
    if (exportedSymbol === undefined) {
      continue;
    }
    const symbol = aliasedSymbol(source.ast, checker, exportedSymbol) ?? exportedSymbol;
    const declaration = primaryDeclaration(checker, symbol);
    const declarationSourceFile = source.ast.getSourceFile(declaration);
    if (declaration === undefined || declarationSourceFile === undefined ||
      declarationSourceFile.IsDeclarationFile) {
      continue;
    }
    moduleExports.push(Object.freeze({
      exportName: checker.getSymbolName(exportedSymbol),
      symbol,
      declaration,
      sourceFile: declarationSourceFile,
    }));
  }
  moduleExports.sort((left, right) =>
    left.exportName.localeCompare(right.exportName, "en") ||
    source.ast.getFileName(left.sourceFile).localeCompare(
      source.ast.getFileName(right.sourceFile),
      "en",
    ) ||
    source.ast.pos(left.declaration) - source.ast.pos(right.declaration)
  );
  return Object.freeze(moduleExports);
}

export function sourceProjectModuleDependencies(
  source: CheckedSourceProgram,
  sourceFiles: ReadonlySet<string>,
  sourceFile: SourceFile,
): readonly SourceProjectModuleDependency[] {
  return sourceProjectModuleReferences(
    source,
    sourceFiles,
    sourceFile,
    true,
  );
}

export function sourceProjectModuleReferences(
  source: CheckedSourceProgram,
  sourceFiles: ReadonlySet<string>,
  sourceFile: SourceFile,
  runtimeOnly = false,
): readonly SourceProjectModuleDependency[] {
  const ast = source.ast;
  const checker = source.getSourceFileQueries(sourceFile).checker;
  const dependencies: SourceProjectModuleDependency[] = [];
  const seen = new Set<string>();
  for (const statement of ast.statements(sourceFile)) {
    if (statement === undefined) {
      continue;
    }
    const reference = getStaticModuleReference(ast, statement);
    if (
      reference === undefined ||
      (runtimeOnly && !reference.hasRuntimeValue)
    ) {
      continue;
    }
    const dependency = resolveProjectDependency(
      ast,
      checker,
      reference.declaration,
      reference.moduleSpecifier,
      reference.kind,
      sourceFiles,
    );
    const dependencyKey = sourceFileIdentity(ast, dependency?.sourceFile);
    if (
      dependency === undefined ||
      dependencyKey === undefined ||
      seen.has(dependencyKey)
    ) {
      continue;
    }
    seen.add(dependencyKey);
    dependencies.push(dependency);
  }
  return Object.freeze(dependencies);
}

export function sourceProjectModuleSpecifierResolution(
  source: CheckedSourceProgram,
  sourceFiles: ReadonlySet<string>,
  moduleSpecifier: Node,
): SourceProjectModuleSpecifierResolution {
  const sourceFile = source.ast.getSourceFile(moduleSpecifier);
  if (sourceFile === undefined) {
    return Object.freeze({ kind: "unresolved", moduleSpecifier });
  }
  const checker = source.getSourceFileQueries(sourceFile).checker;
  const resolvedSourceFile = resolvedModuleSourceFile(
    source.ast,
    checker,
    moduleSpecifier,
  );
  if (resolvedSourceFile === undefined) {
    return Object.freeze({ kind: "unresolved", moduleSpecifier });
  }
  const identity = sourceFileIdentity(source.ast, resolvedSourceFile);
  return !resolvedSourceFile.IsDeclarationFile &&
      identity !== undefined && sourceFiles.has(identity)
    ? Object.freeze({
        kind: "project",
        sourceFile: resolvedSourceFile,
        moduleSpecifier,
      })
    : Object.freeze({ kind: "non-project", moduleSpecifier });
}

export function sourceFileHasTopLevelAwait(
  ast: AstReader,
  sourceFile: SourceFile,
): boolean {
  let found = false;
  const visit = (node: Node): void => {
    if (found) {
      return;
    }
    if (ast.is.IsAwaitExpression(node)) {
      found = true;
      return;
    }
    if (
      ast.is.IsVariableDeclaration(node) &&
      ast.variableDeclarationKind(node) === "await using"
    ) {
      found = true;
      return;
    }
    if (
      ast.is.IsForOfStatement(node) &&
      ast.as.AsForInOrOfStatement(node)?.AwaitModifier !== undefined
    ) {
      found = true;
      return;
    }
    if (isFunctionBoundary(ast, node)) {
      return;
    }
    ast.forEachChild(node, (child) => {
      if (child !== undefined) {
        visit(child);
      }
    });
  };
  for (const statement of ast.statements(sourceFile)) {
    if (statement !== undefined) {
      visit(statement);
    }
  }
  return found;
}

function isFunctionBoundary(ast: AstReader, node: Node): boolean {
  return ast.is.IsFunctionDeclaration(node) ||
    ast.is.IsFunctionExpression(node) ||
    ast.is.IsArrowFunction(node) ||
    ast.is.IsMethodDeclaration(node) ||
    ast.is.IsConstructorDeclaration(node) ||
    ast.is.IsGetAccessorDeclaration(node) ||
    ast.is.IsSetAccessorDeclaration(node);
}

function resolveProjectDependency(
  ast: AstReader,
  checker: TypeCheckerQueries,
  declaration: Node,
  moduleSpecifier: Node,
  kind: "import" | "export",
  sourceFiles: ReadonlySet<string>,
): SourceProjectModuleDependency | undefined {
  const resolvedSourceFile = resolvedModuleSourceFile(ast, checker, moduleSpecifier);
  return resolvedSourceFile !== undefined &&
    !resolvedSourceFile.IsDeclarationFile &&
    sourceFiles.has(sourceFileIdentity(ast, resolvedSourceFile) ?? "")
    ? {
        sourceFile: resolvedSourceFile,
        declaration,
        moduleSpecifier,
        kind,
      }
    : undefined;
}

function resolvedModuleSourceFile(
  ast: AstReader,
  checker: TypeCheckerQueries,
  moduleSpecifier: Node,
): SourceFile | undefined {
  const moduleSymbol = checker.getModuleSymbolFromSpecifier(moduleSpecifier);
  const resolvedModuleSymbol = checker.getResolvedExternalModuleSymbol(
    moduleSymbol,
    false,
  ) ?? moduleSymbol;
  return ast.getSourceFile(
    primaryDeclaration(checker, resolvedModuleSymbol) ??
      primaryDeclaration(checker, moduleSymbol),
  );
}
