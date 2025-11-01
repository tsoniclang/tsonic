/**
 * Module dependency graph builder
 */

import * as ts from "typescript";
import * as path from "node:path";
import { TsonicProgram } from "./program.js";
import {
  ModuleGraph,
  ModuleInfo,
  Import,
  Export,
  createModuleGraph,
} from "./types/module.js";
import {
  Diagnostic,
  DiagnosticsCollector,
  createDiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
} from "./types/diagnostic.js";
import { Result, ok, error } from "./types/result.js";
import {
  resolveImport,
  getNamespaceFromPath,
  getClassNameFromPath,
} from "./resolver.js";
import {
  SymbolTable,
  createSymbolTable,
  addSymbol,
  buildSymbolTable,
} from "./symbol-table.js";

export type DependencyAnalysis = {
  readonly graph: ModuleGraph;
  readonly symbolTable: SymbolTable;
  readonly diagnostics: DiagnosticsCollector;
};

export const buildDependencyGraph = (
  program: TsonicProgram,
  entryPoints: readonly string[]
): DependencyAnalysis => {
  const modules = new Map<string, ModuleInfo>();
  const dependencies = new Map<string, readonly string[]>();
  const dependents = new Map<string, readonly string[]>();
  let symbolTable = createSymbolTable();
  let diagnostics = createDiagnosticsCollector();

  // Process all source files
  program.sourceFiles.forEach((sourceFile) => {
    const moduleInfo = extractModuleInfo(sourceFile, program);
    modules.set(sourceFile.fileName, moduleInfo);

    // Build symbol table
    const symbols = buildSymbolTable(sourceFile, program.checker);
    symbols.forEach((symbol) => {
      symbolTable = addSymbol(symbolTable, symbol);
    });
  });

  // Build dependency relationships
  modules.forEach((module, modulePath) => {
    const deps: string[] = [];

    module.imports.forEach((imp) => {
      if (imp.resolvedPath) {
        deps.push(imp.resolvedPath);

        // Add to dependents map
        const currentDependents = dependents.get(imp.resolvedPath) ?? [];
        dependents.set(imp.resolvedPath, [...currentDependents, modulePath]);
      }
    });

    dependencies.set(modulePath, deps);
  });

  // Check for circular dependencies
  const circularCheck = checkCircularDependencies(dependencies);
  if (!circularCheck.ok) {
    diagnostics = addDiagnostic(diagnostics, circularCheck.error);
  }

  const graph = createModuleGraph(
    modules,
    dependencies,
    dependents,
    entryPoints.map((ep) => path.resolve(ep))
  );

  return {
    graph,
    symbolTable,
    diagnostics,
  };
};

const extractModuleInfo = (
  sourceFile: ts.SourceFile,
  program: TsonicProgram
): ModuleInfo => {
  const imports: Import[] = [];
  const exports: Export[] = [];
  let hasTopLevelCode = false;

  const visitor = (node: ts.Node): void => {
    // Extract imports
    if (ts.isImportDeclaration(node)) {
      const imp = extractImport(node, sourceFile, program);
      if (imp) {
        imports.push(imp);
      }
    }

    // Extract exports
    if (ts.isExportDeclaration(node)) {
      const exp = extractExport(node);
      if (exp) {
        exports.push(exp);
      }
    }

    if (ts.isExportAssignment(node)) {
      exports.push({
        kind: "default",
        localName: node.expression.getText(),
      });
    }

    // Check for exported declarations
    if (hasExportModifier(node)) {
      if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach((decl) => {
          if (ts.isIdentifier(decl.name)) {
            exports.push({
              kind: "named",
              name: decl.name.text,
              localName: decl.name.text,
            });
          }
        });
      } else if (
        (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
        node.name
      ) {
        exports.push({
          kind: "named",
          name: node.name.text,
          localName: node.name.text,
        });
      }
    }

    // Check for top-level code (non-declaration statements)
    if (isTopLevelCode(node)) {
      hasTopLevelCode = true;
    }

    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);

  const namespace = getNamespaceFromPath(
    sourceFile.fileName,
    program.options.sourceRoot,
    program.options.rootNamespace
  );

  const className = getClassNameFromPath(sourceFile.fileName);

  return {
    filePath: sourceFile.fileName,
    sourceText: sourceFile.getFullText(),
    imports,
    exports,
    hasTopLevelCode,
    namespace,
    className,
  };
};

const extractImport = (
  node: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
  program: TsonicProgram
): Import | null => {
  if (!ts.isStringLiteral(node.moduleSpecifier)) {
    return null;
  }

  const specifier = node.moduleSpecifier.text;
  const result = resolveImport(
    specifier,
    sourceFile.fileName,
    program.options.sourceRoot
  );

  const importedNames: { readonly name: string; readonly alias?: string }[] =
    [];

  if (node.importClause) {
    // Default import
    if (node.importClause.name) {
      importedNames.push({
        name: "default",
        alias: node.importClause.name.text,
      });
    }

    // Named imports
    if (node.importClause.namedBindings) {
      if (ts.isNamespaceImport(node.importClause.namedBindings)) {
        // import * as ns from "..."
        importedNames.push({
          name: "*",
          alias: node.importClause.namedBindings.name.text,
        });
      } else if (ts.isNamedImports(node.importClause.namedBindings)) {
        // import { a, b as c } from "..."
        node.importClause.namedBindings.elements.forEach((spec) => {
          importedNames.push({
            name: (spec.propertyName ?? spec.name).text,
            alias: spec.propertyName ? spec.name.text : undefined,
          });
        });
      }
    }
  }

  if (result.ok) {
    return {
      kind: result.value.isLocal
        ? "local"
        : result.value.isDotNet
          ? "dotnet"
          : "node_module",
      specifier,
      resolvedPath: result.value.resolvedPath || undefined,
      namespace: result.value.isDotNet ? specifier : undefined,
      importedNames,
    };
  }

  return {
    kind: "local",
    specifier,
    importedNames,
  };
};

const extractExport = (node: ts.ExportDeclaration): Export | null => {
  if (
    !node.moduleSpecifier &&
    node.exportClause &&
    ts.isNamedExports(node.exportClause)
  ) {
    // export { a, b as c } - named exports without re-export
    const elements = Array.from(node.exportClause.elements);
    if (elements.length > 0 && elements[0]) {
      const spec = elements[0];
      return {
        kind: "named",
        name: spec.name.text,
        localName: (spec.propertyName ?? spec.name).text,
      };
    }
    return null;
  }

  if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
    // export { ... } from "..." - re-exports
    const fromModule = node.moduleSpecifier.text;
    const exportedNames: { readonly name: string; readonly alias?: string }[] =
      [];

    if (node.exportClause) {
      if (ts.isNamedExports(node.exportClause)) {
        Array.from(node.exportClause.elements).forEach((spec) => {
          exportedNames.push({
            name: (spec.propertyName ?? spec.name).text,
            alias: spec.propertyName ? spec.name.text : undefined,
          });
        });
      }
    }

    return {
      kind: "reexport",
      fromModule,
      exports: exportedNames,
    };
  }

  return null;
};

const checkCircularDependencies = (
  dependencies: ReadonlyMap<string, readonly string[]>
): Result<void, Diagnostic> => {
  const visited = new Set<string>();
  const stack = new Set<string>();

  const visit = (module: string, path: string[]): string[] | null => {
    if (stack.has(module)) {
      return [...path, module]; // Found cycle
    }

    if (visited.has(module)) {
      return null; // Already checked
    }

    visited.add(module);
    stack.add(module);

    const deps = dependencies.get(module) ?? [];
    for (const dep of deps) {
      const cycle = visit(dep, [...path, module]);
      if (cycle) {
        return cycle;
      }
    }

    stack.delete(module);
    return null;
  };

  for (const [module] of dependencies) {
    const cycle = visit(module, []);
    if (cycle) {
      return error(
        createDiagnostic(
          "TSN1002",
          "error",
          `Circular dependency detected: ${cycle.map((m) => path.basename(m)).join(" → ")}`,
          undefined,
          "Break the circular dependency by refactoring shared code"
        )
      );
    }
  }

  return ok(undefined);
};

const isTopLevelCode = (node: ts.Node): boolean => {
  // Check if this is a top-level statement that's not a declaration
  if (node.parent && ts.isSourceFile(node.parent)) {
    return (
      !ts.isModuleDeclaration(node) &&
      !ts.isImportDeclaration(node) &&
      !ts.isExportDeclaration(node) &&
      !ts.isExportAssignment(node) &&
      !ts.isTypeAliasDeclaration(node) &&
      !ts.isInterfaceDeclaration(node) &&
      !(ts.isVariableStatement(node) && !hasExecutableInitializer(node)) &&
      !ts.isFunctionDeclaration(node) &&
      !ts.isClassDeclaration(node) &&
      !ts.isEnumDeclaration(node)
    );
  }
  return false;
};

const hasExecutableInitializer = (node: ts.VariableStatement): boolean => {
  return node.declarationList.declarations.some(
    (decl) => decl.initializer && !ts.isLiteralExpression(decl.initializer)
  );
};

const hasExportModifier = (node: ts.Node): boolean => {
  if (!ts.canHaveModifiers(node)) {
    return false;
  }
  const modifiers = ts.getModifiers(node);
  return (
    modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
  );
};
