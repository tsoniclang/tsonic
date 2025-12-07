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
import { CompilerOptions, TsonicProgram } from "./types.js";
import { loadAllDiscoveredBindings } from "./bindings.js";
import { validateIrSoundness } from "../ir/validation/soundness-gate.js";

export type ModuleDependencyGraphResult = {
  readonly modules: readonly IrModule[];
  readonly entryModule: IrModule;
};

/**
 * Scan all source files for import statements and discover CLR bindings.
 * This must be called BEFORE IR building to ensure bindings are loaded.
 *
 * Returns set of binding paths that were discovered.
 */
const discoverAndLoadClrBindings = (
  program: TsonicProgram,
  verbose?: boolean
): void => {
  const bindingPaths = new Set<string>();

  if (verbose) {
    console.log(
      `[CLR Bindings] Scanning ${program.sourceFiles.length} source files`
    );
  }

  for (const sourceFile of program.sourceFiles) {
    if (verbose) {
      console.log(`[CLR Bindings] Scanning: ${sourceFile.fileName}`);
    }
    ts.forEachChild(sourceFile, (node) => {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const moduleSpecifier = node.moduleSpecifier.text;
        if (verbose) {
          console.log(`[CLR Bindings] Found import: ${moduleSpecifier}`);
        }
        // Use the resolver to check if this is a CLR import
        const resolution = program.clrResolver.resolve(moduleSpecifier);
        if (resolution.isClr) {
          if (verbose) {
            console.log(
              `[CLR Bindings] CLR import detected: ${resolution.bindingsPath}`
            );
          }
          bindingPaths.add(resolution.bindingsPath);
        }
      }
    });
  }

  // Load all discovered bindings into the registry
  if (bindingPaths.size > 0) {
    if (verbose) {
      console.log(
        `[CLR Bindings] Loading ${bindingPaths.size} binding files...`
      );
    }
    loadAllDiscoveredBindings(program.bindings, bindingPaths);
    if (verbose) {
      console.log(`[CLR Bindings] Bindings loaded successfully`);
    }
  } else if (verbose) {
    console.log(`[CLR Bindings] No CLR bindings discovered`);
  }
};

/**
 * Extract module specifier from import or re-export declaration
 * Returns the module specifier string literal, or null if not applicable
 */
const getModuleSpecifier = (stmt: ts.Statement): ts.StringLiteral | null => {
  // Handle: import { x } from "./module"
  if (
    ts.isImportDeclaration(stmt) &&
    ts.isStringLiteral(stmt.moduleSpecifier)
  ) {
    return stmt.moduleSpecifier;
  }

  // Handle: export { x } from "./module" (re-exports)
  if (
    ts.isExportDeclaration(stmt) &&
    stmt.moduleSpecifier &&
    ts.isStringLiteral(stmt.moduleSpecifier)
  ) {
    return stmt.moduleSpecifier;
  }

  return null;
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
    const currentFile = queue.shift();
    if (currentFile === undefined) continue;

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

    // Extract local imports and re-exports using TypeScript's resolution
    for (const stmt of sourceFile.statements) {
      // Handle import declarations: import { x } from "./module"
      // Handle re-export declarations: export { x } from "./module"
      const moduleSpecifier = getModuleSpecifier(stmt);
      if (!moduleSpecifier) {
        continue;
      }

      const importSpecifier = moduleSpecifier.text;

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

  // Load CLR bindings before IR building
  // This scans all imports and loads their bindings upfront
  discoverAndLoadClrBindings(tsonicProgram, options.verbose);

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

  // Run IR soundness gate - validates no anyType leaked through
  // This is the final validation before emitter can run
  const soundnessResult = validateIrSoundness(modules);
  if (!soundnessResult.ok) {
    return error(soundnessResult.diagnostics);
  }

  // Sort modules by relative path for deterministic output
  modules.sort((a, b) => a.filePath.localeCompare(b.filePath));

  // Entry module is the first one (after sorting, it should be the entry file)
  // But let's find it by matching the entry file path
  const entryRelative = relative(sourceRootAbs, entryAbs).replace(/\\/g, "/");
  const foundEntryModule = modules.find((m) => m.filePath === entryRelative);
  const entryModule = foundEntryModule ?? modules[0];
  if (entryModule === undefined) {
    return error([
      createDiagnostic("TSN1001", "error", "No modules found in the project", {
        file: entryAbs,
        line: 1,
        column: 1,
        length: 1,
      }),
    ]);
  }

  return ok({
    modules,
    entryModule,
  });
};
