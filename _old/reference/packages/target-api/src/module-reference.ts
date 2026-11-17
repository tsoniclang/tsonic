import type { AstReader, Node } from "@tsonic/tsts";

export interface StaticModuleReference {
  readonly declaration: Node;
  readonly moduleSpecifier: Node;
  readonly kind: "import" | "export";
  readonly hasRuntimeValue: boolean;
}

export function getStaticModuleReference(
  ast: AstReader,
  statement: Node,
): StaticModuleReference | undefined {
  if (ast.is.IsImportDeclaration(statement)) {
    const declaration = ast.as.AsImportDeclaration(statement);
    if (declaration === undefined) {
      throw new Error("TSTS import-declaration predicate and cast disagreed.");
    }
    const moduleSpecifier = declaration?.ModuleSpecifier;
    return moduleSpecifier === undefined
      ? undefined
      : {
          declaration: statement,
          moduleSpecifier,
          kind: "import",
          hasRuntimeValue: importHasRuntimeValue(ast, statement, declaration.ImportClause),
        };
  }
  if (ast.is.IsExportDeclaration(statement)) {
    const declaration = ast.as.AsExportDeclaration(statement);
    if (declaration === undefined) {
      throw new Error("TSTS export-declaration predicate and cast disagreed.");
    }
    const moduleSpecifier = declaration?.ModuleSpecifier;
    return moduleSpecifier === undefined
      ? undefined
      : {
          declaration: statement,
          moduleSpecifier,
          kind: "export",
          hasRuntimeValue: exportHasRuntimeValue(ast, declaration.IsTypeOnly === true, declaration.ExportClause),
        };
  }
  return undefined;
}

function importHasRuntimeValue(
  ast: AstReader,
  declaration: Node,
  importClause: Node | undefined,
): boolean {
  if (importClause === undefined) {
    return true;
  }
  if (!ast.is.IsImportClause(importClause)) {
    throw new Error("TSTS import declaration returned a non-import-clause child.");
  }
  if (ast.isTypeOnlyImportDeclaration(declaration)) {
    return false;
  }
  const clause = ast.as.AsImportClause(importClause);
  if (clause === undefined) {
    throw new Error("TSTS import-clause predicate and cast disagreed.");
  }
  if (clause.name !== undefined) {
    return true;
  }
  const namedBindings = clause.NamedBindings;
  if (namedBindings === undefined) {
    return true;
  }
  if (ast.is.IsNamespaceImport(namedBindings)) {
    return true;
  }
  if (!ast.is.IsNamedImports(namedBindings)) {
    throw new Error("TSTS import clause returned unsupported named bindings.");
  }
  const elements = ast.elements(namedBindings);
  if (elements.length === 0) {
    return true;
  }
  return elements.some((element) => {
    if (element === undefined || !ast.is.IsImportSpecifier(element)) {
      throw new Error("TSTS named imports returned a non-import-specifier element.");
    }
    return !ast.isTypeOnlyImportOrExportDeclaration(element);
  });
}

function exportHasRuntimeValue(
  ast: AstReader,
  isTypeOnly: boolean,
  exportClause: Node | undefined,
): boolean {
  if (isTypeOnly) {
    return false;
  }
  if (exportClause === undefined || ast.is.IsNamespaceExport(exportClause)) {
    return true;
  }
  if (!ast.is.IsNamedExports(exportClause)) {
    throw new Error("TSTS export declaration returned unsupported export bindings.");
  }
  const elements = ast.elements(exportClause);
  if (elements.length === 0) {
    return true;
  }
  return elements.some((element) => {
    if (element === undefined || !ast.is.IsExportSpecifier(element)) {
      throw new Error("TSTS named exports returned a non-export-specifier element.");
    }
    return !ast.isTypeOnlyImportOrExportDeclaration(element);
  });
}
