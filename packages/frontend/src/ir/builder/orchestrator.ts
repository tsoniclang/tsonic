/**
 * IR Builder orchestration - Main module building logic
 *
 * Phase 5 Step 4: Uses ProgramContext instead of global singletons.
 */

import * as ts from "typescript";
import { relative } from "path";
import { IrModule } from "../types.js";
import { TsonicProgram } from "../../program.js";
import { getNamespaceFromPath, getClassNameFromPath } from "../../resolver.js";
import { Result, ok, error } from "../../types/result.js";
import {
  Diagnostic,
  createDiagnostic,
  isFatal,
} from "../../types/diagnostic.js";
import {
  createProgramContext,
  type ProgramContext,
} from "../program-context.js";
import { IrBuildOptions } from "./types.js";
import { extractImports } from "./imports.js";
import { extractExportsWithContext } from "./exports.js";
import { extractStatements, isExecutableStatement } from "./statements.js";
import { validateClassImplements } from "./validation.js";

/**
 * Build IR module from TypeScript source file
 *
 * @param sourceFile - The TypeScript source file to convert
 * @param program - The Tsonic program with type checker and bindings
 * @param options - Build options (sourceRoot, rootNamespace)
 * @param ctx - ProgramContext for TypeSystem and other shared resources.
 *              Required - no global state fallback.
 */
export const buildIrModule = (
  sourceFile: ts.SourceFile,
  program: TsonicProgram,
  options: IrBuildOptions,
  ctx: ProgramContext
): Result<IrModule, Diagnostic> => {
  try {
    const namespace = getNamespaceFromPath(
      sourceFile.fileName,
      options.sourceRoot,
      options.rootNamespace
    );
    const className = getClassNameFromPath(
      sourceFile.fileName,
      program.options.namingPolicy?.classes
    );

    const imports = extractImports(sourceFile, ctx);
    const exports = extractExportsWithContext(sourceFile, ctx);
    const statements = extractStatements(sourceFile, ctx);

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

    // Validate class implements patterns
    // TypeScript interfaces are nominalized to C# classes, so "implements" is invalid
    const implementsDiagnostics = validateClassImplements(sourceFile, ctx);
    const firstImplementsDiagnostic = implementsDiagnostics[0];
    if (firstImplementsDiagnostic) {
      return error(firstImplementsDiagnostic);
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

    // Compute relative file path from source root
    // Normalize to forward slashes for cross-platform consistency
    const relativePath = relative(
      options.sourceRoot,
      sourceFile.fileName
    ).replace(/\\/g, "/");

    const module: IrModule = {
      kind: "module",
      filePath: relativePath, // Now stores relative path instead of absolute
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
  // Create ProgramContext — the single owner of all semantic state
  // No global singletons are used; context is passed explicitly
  const ctx = createProgramContext(program, options);

  const modules: IrModule[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const sourceFile of program.sourceFiles) {
    const result = buildIrModule(sourceFile, program, options, ctx);
    if (result.ok) {
      modules.push(result.value);
    } else {
      diagnostics.push(result.error);
      // Fatal diagnostics abort immediately - no point continuing
      if (isFatal(result.error)) {
        return error(diagnostics);
      }
    }
  }

  if (diagnostics.length > 0) {
    return error(diagnostics);
  }

  return ok(modules);
};
