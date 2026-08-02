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
} from "./types.js";
import {
  primaryDeclaration,
} from "./syntax.js";

export function sourceProjectModuleDependencies(
  source: CheckedSourceProgram,
  sourceFiles: ReadonlySet<string>,
  sourceFile: SourceFile,
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
    if (reference === undefined || !reference.hasRuntimeValue) {
      continue;
    }
    const dependency = resolveRuntimeDependency(
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

function resolveRuntimeDependency(
  ast: AstReader,
  checker: TypeCheckerQueries,
  declaration: Node,
  moduleSpecifier: Node,
  kind: "import" | "export",
  sourceFiles: ReadonlySet<string>,
): SourceProjectModuleDependency | undefined {
  const moduleSymbol = checker.getModuleSymbolFromSpecifier(moduleSpecifier);
  const resolvedModuleSymbol = checker.getResolvedExternalModuleSymbol(
    moduleSymbol,
    false,
  ) ?? moduleSymbol;
  const resolvedSourceFile = ast.getSourceFile(
    primaryDeclaration(checker, resolvedModuleSymbol) ??
      primaryDeclaration(checker, moduleSymbol),
  );
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
