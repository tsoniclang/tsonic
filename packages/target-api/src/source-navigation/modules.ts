import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourceNavigationInput } from "../host-input/navigation.js";
import { getStaticModuleReference } from "../module-reference.js";
import { sourceFileIdentity } from "./identity.js";
import type { SourceProjectModuleDependency, SourceProjectModuleExport, SourceProjectModuleSpecifierResolution } from "./types.js";
import { isSourceCallableBodyBoundary } from "./callable-boundaries.js";

/** The module's exports with a declaration in a source (non-declaration) file, sorted by name, file and position. */
export function sourceProjectModuleExports(
  source: Pick<SourceNavigationInput, "ast" | "moduleExports">,
  sourceFile: SourceFile,
): readonly SourceProjectModuleExport[] {
  const moduleExports = source.moduleExports(sourceFile)
    .filter(entry => !entry.sourceFile.IsDeclarationFile)
    .map(entry => Object.freeze({ exportName: entry.exportName, declaration: entry.declaration, sourceFile: entry.sourceFile }));
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
  source: Pick<SourceNavigationInput, "ast" | "moduleSourceFile">,
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
  source: Pick<SourceNavigationInput, "ast" | "moduleSourceFile">,
  sourceFiles: ReadonlySet<string>,
  sourceFile: SourceFile,
  runtimeOnly = false,
): readonly SourceProjectModuleDependency[] {
  const ast = source.ast;
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
      source.moduleSourceFile(reference.moduleSpecifier),
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
  source: Pick<SourceNavigationInput, "ast" | "moduleSourceFile">,
  sourceFiles: ReadonlySet<string>,
  moduleSpecifier: Node,
): SourceProjectModuleSpecifierResolution {
  const sourceFile = source.ast.getSourceFile(moduleSpecifier);
  if (sourceFile === undefined) {
    return Object.freeze({ kind: "unresolved", moduleSpecifier });
  }
  const resolvedSourceFile = source.moduleSourceFile(moduleSpecifier);
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
    if (isSourceCallableBodyBoundary(ast, node)) {
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

function resolveProjectDependency(
  ast: AstReader,
  resolvedSourceFile: SourceFile | undefined,
  declaration: Node,
  moduleSpecifier: Node,
  kind: "import" | "export",
  sourceFiles: ReadonlySet<string>,
): SourceProjectModuleDependency | undefined {
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
