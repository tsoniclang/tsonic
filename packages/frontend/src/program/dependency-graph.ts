/**
 * Dependency graph builder - Multi-file compilation
 * Traverses local imports using ts.resolveModuleName()
 */

import * as ts from "typescript";
import { relative, resolve } from "path";
import { Result, ok, error } from "../types/result.js";
import { Diagnostic, createDiagnostic } from "../types/diagnostic.js";
import { IrModule } from "../ir/types.js";
import { buildIrModule } from "../ir/builder/orchestrator.js";
import { createProgram, createCompilerOptions } from "./creation.js";
import { CompilerOptions } from "./types.js";

export type ModuleDependencyGraphResult = {
  readonly modules: readonly IrModule[];
  readonly entryModule: IrModule;
};

/**
 * Build complete module dependency graph from entry point
 * Traverses all local imports and builds IR for all discovered modules
 * Uses TypeScript's ts.resolveModuleName() for correct module resolution
 */
export const buildModuleDependencyGraph = (
  entryFile: string,
  options: CompilerOptions
): Result<ModuleDependencyGraphResult, readonly Diagnostic[]> => {
  const diagnostics: Diagnostic[] = [];

  // Normalize entry file and source root to absolute paths
  const entryAbs = resolve(entryFile);
  const sourceRootAbs = resolve(options.sourceRoot);

  // Get TypeScript compiler options for module resolution
  const compilerOptions = createCompilerOptions(options);

  // Track all discovered files for later type checking
  const allDiscoveredFiles: string[] = [];

  // BFS to discover all local imports
  const visited = new Set<string>();
  const queue: string[] = [entryAbs];

  // First pass: discover all files
  while (queue.length > 0) {
    const currentFile = queue.shift()!;

    // Dedup by realpath (handles symlinks, relative paths)
    const realPath = ts.sys.realpath?.(currentFile) ?? currentFile;
    if (visited.has(realPath)) {
      continue;
    }
    visited.add(realPath);
    allDiscoveredFiles.push(realPath);

    // Read source file directly from filesystem
    const sourceText = ts.sys.readFile(currentFile);
    if (!sourceText) {
      // Missing file - add diagnostic but continue traversal
      const relativeCurrent = relative(sourceRootAbs, currentFile);
      diagnostics.push(
        createDiagnostic(
          "TSN1002",
          "error",
          `Cannot find module '${relativeCurrent}'`,
          {
            file: currentFile,
            line: 1,
            column: 1,
            length: 1,
          }
        )
      );
      continue;
    }

    // Parse source file to extract imports
    const sourceFile = ts.createSourceFile(
      currentFile,
      sourceText,
      ts.ScriptTarget.Latest,
      true
    );

    // Extract local imports using TypeScript's resolution
    for (const stmt of sourceFile.statements) {
      if (
        !ts.isImportDeclaration(stmt) ||
        !ts.isStringLiteral(stmt.moduleSpecifier)
      ) {
        continue;
      }

      const importSpecifier = stmt.moduleSpecifier.text;

      // Only process local imports (starts with . or /)
      if (
        !importSpecifier.startsWith(".") &&
        !importSpecifier.startsWith("/")
      ) {
        continue;
      }

      // Resolve using TypeScript's module resolution
      const resolved = ts.resolveModuleName(
        importSpecifier,
        currentFile,
        compilerOptions,
        ts.sys
      );

      if (resolved.resolvedModule?.resolvedFileName) {
        const resolvedPath = resolved.resolvedModule.resolvedFileName;

        // Only include .ts files (not .d.ts) within source root
        if (
          resolvedPath.startsWith(sourceRootAbs) &&
          resolvedPath.endsWith(".ts") &&
          !resolvedPath.endsWith(".d.ts")
        ) {
          queue.push(resolvedPath);
        }
      } else {
        // Import resolution failed - add diagnostic with context
        const relativeCurrent = relative(sourceRootAbs, currentFile);
        diagnostics.push(
          createDiagnostic(
            "TSN1002",
            "error",
            `Cannot resolve import '${importSpecifier}' from '${relativeCurrent}'`,
            {
              file: currentFile,
              line: stmt.getStart(sourceFile),
              column: 1,
              length: importSpecifier.length,
            }
          )
        );
      }
    }
  }

  // If any diagnostics from discovery, fail the build
  if (diagnostics.length > 0) {
    return error(diagnostics);
  }

  // Ensure we discovered at least the entry file
  if (allDiscoveredFiles.length === 0) {
    return error([
      createDiagnostic(
        "TSN1002",
        "error",
        `No modules found starting from entry point '${entryFile}'`,
        {
          file: entryFile,
          line: 1,
          column: 1,
          length: 1,
        }
      ),
    ]);
  }

  // Second pass: Create TypeScript program with all discovered files for type checking
  // Use absolute sourceRoot for consistency
  const programResult = createProgram(allDiscoveredFiles, {
    ...options,
    sourceRoot: sourceRootAbs,
  });

  if (!programResult.ok) {
    return error(programResult.error.diagnostics);
  }

  const tsonicProgram = programResult.value;

  // Third pass: Build IR for all discovered modules
  const modules: IrModule[] = [];

  for (const filePath of allDiscoveredFiles) {
    const sourceFile = tsonicProgram.program.getSourceFile(filePath);
    if (!sourceFile) {
      // This shouldn't happen since we already verified files exist
      continue;
    }

    const moduleResult = buildIrModule(sourceFile, tsonicProgram, {
      sourceRoot: sourceRootAbs,
      rootNamespace: options.rootNamespace,
    });

    if (!moduleResult.ok) {
      diagnostics.push(moduleResult.error);
      continue;
    }

    modules.push(moduleResult.value);
  }

  // If any diagnostics from IR building, fail the build
  if (diagnostics.length > 0) {
    return error(diagnostics);
  }

  // Sort modules by relative path for deterministic output
  modules.sort((a, b) => a.filePath.localeCompare(b.filePath));

  // Entry module is the first one (after sorting, it should be the entry file)
  // But let's find it by matching the entry file path
  const entryRelative = relative(sourceRootAbs, entryAbs).replace(/\\/g, "/");
  const entryModule =
    modules.find((m) => m.filePath === entryRelative) ?? modules[0]!;

  return ok({
    modules,
    entryModule,
  });
};
