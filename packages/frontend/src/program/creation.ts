/**
 * Program creation
 */

import * as ts from "typescript";
import * as path from "node:path";
import * as fs from "node:fs";
import { Result, ok, error } from "../types/result.js";
import { DiagnosticsCollector } from "../types/diagnostic.js";
import { CompilerOptions, TsonicProgram } from "./types.js";
import { defaultTsConfig } from "./config.js";
import { loadDotnetMetadata } from "./metadata.js";
import { loadBindings } from "./bindings.js";
import { collectTsDiagnostics } from "./diagnostics.js";

/**
 * Recursively scan a directory for .d.ts files
 */
const scanForDeclarationFiles = (dir: string): readonly string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanForDeclarationFiles(fullPath));
    } else if (entry.name.endsWith(".d.ts")) {
      results.push(fullPath);
    }
  }

  return results;
};

/**
 * Create a Tsonic program from TypeScript source files
 */
export const createProgram = (
  filePaths: readonly string[],
  options: CompilerOptions
): Result<TsonicProgram, DiagnosticsCollector> => {
  const absolutePaths = filePaths.map((fp) => path.resolve(fp));

  // Get declaration files from type roots
  const typeRoots = options.typeRoots ?? [
    "node_modules/@tsonic/dotnet-types/types",
  ];
  const declarationFiles: string[] = [];

  for (const typeRoot of typeRoots) {
    const absoluteRoot = path.resolve(typeRoot);
    declarationFiles.push(...scanForDeclarationFiles(absoluteRoot));
  }

  // Combine source files and declaration files
  const allFiles = [...absolutePaths, ...declarationFiles];

  const tsOptions: ts.CompilerOptions = {
    ...defaultTsConfig,
    strict: options.strict ?? true,
    rootDir: options.sourceRoot,
  };

  const host = ts.createCompilerHost(tsOptions);
  const program = ts.createProgram(allFiles, tsOptions, host);

  const diagnostics = collectTsDiagnostics(program);

  if (diagnostics.hasErrors) {
    return error(diagnostics);
  }

  const sourceFiles = program
    .getSourceFiles()
    .filter(
      (sf) => !sf.isDeclarationFile && absolutePaths.includes(sf.fileName)
    );

  // Load .NET metadata files
  const metadata = loadDotnetMetadata(typeRoots);

  // Load binding manifests
  const bindings = loadBindings(typeRoots);

  return ok({
    program,
    checker: program.getTypeChecker(),
    options,
    sourceFiles,
    metadata,
    bindings,
  });
};
