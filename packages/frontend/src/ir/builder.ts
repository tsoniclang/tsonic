/**
 * IR Builder - Main module for converting TypeScript AST to IR
 */

import * as ts from "typescript";
import {
  IrModule,
  IrImport,
  IrImportSpecifier,
  IrExport,
  IrStatement,
} from "./types.js";
import { TsonicProgram } from "../program.js";
import { getNamespaceFromPath, getClassNameFromPath } from "../resolver.js";
import { Result, ok, error } from "../types/result.js";
import { Diagnostic, createDiagnostic } from "../types/diagnostic.js";
import {
  convertStatement,
  setMetadataRegistry,
} from "./statement-converter.js";
import { convertExpression } from "./expression-converter.js";

export type IrBuildOptions = {
  readonly sourceRoot: string;
  readonly rootNamespace: string;
};

/**
 * Build IR module from TypeScript source file
 */
export const buildIrModule = (
  sourceFile: ts.SourceFile,
  program: TsonicProgram,
  options: IrBuildOptions
): Result<IrModule, Diagnostic> => {
  try {
    // Set the metadata registry for this compilation
    setMetadataRegistry(program.metadata);

    const namespace = getNamespaceFromPath(
      sourceFile.fileName,
      options.sourceRoot,
      options.rootNamespace
    );
    const className = getClassNameFromPath(sourceFile.fileName);

    const imports = extractImports(sourceFile);
    const exports = extractExports(sourceFile, program.checker);
    const statements = extractStatements(sourceFile, program.checker);

    // Determine if this should be a static container
    // Per spec: Files with a class matching the filename should NOT be static containers
    // Static containers are for top-level functions and constants
    const hasClassMatchingFilename = statements.some(
      (stmt) => stmt.kind === "classDeclaration" && stmt.name === className
    );

    const hasTopLevelCode = statements.some(isExecutableStatement);
    const isStaticContainer =
      !hasClassMatchingFilename && !hasTopLevelCode && exports.length > 0;

    const module: IrModule = {
      kind: "module",
      filePath: sourceFile.fileName,
      namespace,
      className,
      isStaticContainer,
      imports,
      body: statements,
      exports,
    };

    return ok(module);
  } catch (err) {
    return error(
      createDiagnostic(
        "TSN6001",
        "error",
        `Failed to build IR: ${err instanceof Error ? err.message : String(err)}`,
        {
          file: sourceFile.fileName,
          line: 1,
          column: 1,
          length: 1,
        }
      )
    );
  }
};

/**
 * Build IR for all source files in the program
 */
export const buildIr = (
  program: TsonicProgram,
  options: IrBuildOptions
): Result<readonly IrModule[], readonly Diagnostic[]> => {
  const modules: IrModule[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const sourceFile of program.sourceFiles) {
    const result = buildIrModule(sourceFile, program, options);
    if (result.ok) {
      modules.push(result.value);
    } else {
      diagnostics.push(result.error);
    }
  }

  if (diagnostics.length > 0) {
    return error(diagnostics);
  }

  return ok(modules);
};

const extractImports = (sourceFile: ts.SourceFile): readonly IrImport[] => {
  const imports: IrImport[] = [];

  const visitor = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const source = node.moduleSpecifier.text;
      const isLocal = source.startsWith(".") || source.startsWith("/");
      const isDotNet =
        !isLocal && !source.includes("/") && /^[A-Z]/.test(source);
      const specifiers = extractImportSpecifiers(node);

      imports.push({
        kind: "import",
        source,
        isLocal,
        isDotNet,
        specifiers,
        resolvedNamespace: isDotNet ? source : undefined,
      });
    }
    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return imports;
};

const extractImportSpecifiers = (
  node: ts.ImportDeclaration
): readonly IrImportSpecifier[] => {
  const specifiers: IrImportSpecifier[] = [];

  if (node.importClause) {
    // Default import
    if (node.importClause.name) {
      specifiers.push({
        kind: "default",
        localName: node.importClause.name.text,
      });
    }

    // Named or namespace imports
    if (node.importClause.namedBindings) {
      if (ts.isNamespaceImport(node.importClause.namedBindings)) {
        specifiers.push({
          kind: "namespace",
          localName: node.importClause.namedBindings.name.text,
        });
      } else if (ts.isNamedImports(node.importClause.namedBindings)) {
        node.importClause.namedBindings.elements.forEach((spec) => {
          specifiers.push({
            kind: "named",
            name: (spec.propertyName ?? spec.name).text,
            localName: spec.name.text,
          });
        });
      }
    }
  }

  return specifiers;
};

const extractExports = (
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): readonly IrExport[] => {
  const exports: IrExport[] = [];

  const visitor = (node: ts.Node): void => {
    if (ts.isExportDeclaration(node)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        node.exportClause.elements.forEach((spec) => {
          exports.push({
            kind: "named",
            name: spec.name.text,
            localName: (spec.propertyName ?? spec.name).text,
          });
        });
      }
    } else if (ts.isExportAssignment(node)) {
      exports.push({
        kind: "default",
        expression: convertExpression(node.expression, checker),
      });
    } else if (hasExportModifier(node)) {
      const hasDefault = hasDefaultModifier(node);
      if (hasDefault) {
        // export default function/class/etc
        const stmt = convertStatement(node, checker);
        if (stmt) {
          exports.push({
            kind: "default",
            expression: { kind: "identifier", name: "_default" }, // placeholder for now
          });
        }
      } else {
        // regular export
        const stmt = convertStatement(node, checker);
        if (stmt) {
          exports.push({
            kind: "declaration",
            declaration: stmt,
          });
        }
      }
    }
    ts.forEachChild(node, visitor);
  };

  visitor(sourceFile);
  return exports;
};

const extractStatements = (
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker
): readonly IrStatement[] => {
  const statements: IrStatement[] = [];

  sourceFile.statements.forEach((stmt) => {
    // Skip imports and exports (handled separately)
    if (
      !ts.isImportDeclaration(stmt) &&
      !ts.isExportDeclaration(stmt) &&
      !ts.isExportAssignment(stmt)
    ) {
      const converted = convertStatement(stmt, checker);
      if (converted) {
        statements.push(converted);
      }
    }
  });

  return statements;
};

const isExecutableStatement = (stmt: IrStatement): boolean => {
  // Declarations are not executable - they become static members in the container
  const declarationKinds = [
    "functionDeclaration",
    "classDeclaration",
    "interfaceDeclaration",
    "typeAliasDeclaration",
    "enumDeclaration",
    "variableDeclaration", // Added: variable declarations become static fields
  ];

  // Empty statements are not executable
  if (stmt.kind === "emptyStatement") {
    return false;
  }

  return !declarationKinds.includes(stmt.kind);
};

const hasExportModifier = (node: ts.Node): boolean => {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return (
    modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
  );
};

const hasDefaultModifier = (node: ts.Node): boolean => {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return (
    modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false
  );
};
