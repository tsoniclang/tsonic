/**
 * IR Builder orchestration - Main module building logic
 */

import * as ts from "typescript";
import { IrModule } from "../types.js";
import { TsonicProgram } from "../../program.js";
import { getNamespaceFromPath, getClassNameFromPath } from "../../resolver.js";
import { Result, ok, error } from "../../types/result.js";
import { Diagnostic, createDiagnostic } from "../../types/diagnostic.js";
import { setMetadataRegistry } from "../statement-converter.js";
import { IrBuildOptions } from "./types.js";
import { extractImports } from "./imports.js";
import { extractExports } from "./exports.js";
import { extractStatements, isExecutableStatement } from "./statements.js";

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

    // Check for file name / export name collision (Issue #4)
    // When file name matches an exported function/variable name, C# will have illegal code
    // Example: main.ts exporting function main() → class main { void main() } ❌
    // Note: Classes are allowed to match file name (Person.ts → class Person) - that's the normal pattern
    const collisionExport = exports.find((exp) => {
      if (exp.kind === "declaration") {
        const decl = exp.declaration;
        // Only check functions and variables, NOT classes (classes matching filename is normal)
        if (decl.kind === "functionDeclaration") {
          return decl.name === className;
        } else if (decl.kind === "variableDeclaration") {
          // Check if any of the variable declarators has a matching name
          return decl.declarations.some((declarator) => {
            if (declarator.name.kind === "identifierPattern") {
              return declarator.name.name === className;
            }
            return false;
          });
        }
      } else if (exp.kind === "named") {
        // For named exports, we need to check what's being exported
        // This is more complex because we'd need to look it up in statements
        // For now, skip named exports (they're usually re-exports)
        return false;
      }
      return false;
    });

    if (collisionExport) {
      return error(
        createDiagnostic(
          "TSN2003",
          "error",
          `File name '${className}' conflicts with exported member name. In C#, a type cannot contain a member with the same name as the enclosing type. Consider renaming the file or the exported member.`,
          {
            file: sourceFile.fileName,
            line: 1,
            column: 1,
            length: className.length,
          }
        )
      );
    }

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
