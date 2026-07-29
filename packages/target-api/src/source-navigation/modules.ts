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
      sourceFile,
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

function resolveRuntimeDependency(
  ast: AstReader,
  checker: TypeCheckerQueries,
  declaration: Node,
  moduleSpecifier: Node,
  kind: "import" | "export",
  sourceFile: SourceFile,
  sourceFiles: ReadonlySet<string>,
): SourceProjectModuleDependency | undefined {
  const moduleSymbol = checker.getModuleSymbolFromSpecifier(
    moduleSpecifier,
    { sourceFile },
  );
  const resolvedModuleSymbol = checker.getResolvedExternalModuleSymbol(
    moduleSymbol,
    false,
    { sourceFile },
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
