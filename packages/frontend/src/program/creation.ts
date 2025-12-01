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
import { createClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";

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
 * Create TypeScript compiler options from Tsonic options
 * Exported for use by dependency graph builder
 */
export const createCompilerOptions = (
  options: CompilerOptions
): ts.CompilerOptions => {
  const baseConfig = {
    ...defaultTsConfig,
    strict: options.strict ?? true,
    rootDir: options.sourceRoot,
  };

  // When useStandardLib is true, disable noLib to use TypeScript's built-in types
  // This is useful for tests that don't have access to BCL bindings
  if (options.useStandardLib) {
    return {
      ...baseConfig,
      noLib: false,
      types: undefined, // Use default type resolution
    };
  }

  return baseConfig;
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

  // Debug log typeRoots
  if (options.verbose && typeRoots.length > 0) {
    console.log(`TypeRoots: ${typeRoots.join(", ")}`);
  }

  const declarationFiles: string[] = [];

  for (const typeRoot of typeRoots) {
    const absoluteRoot = path.resolve(typeRoot);
    declarationFiles.push(...scanForDeclarationFiles(absoluteRoot));
  }

  // Add the main index.d.ts files for .NET namespaces directly to the file list
  const namespaceIndexFiles: string[] = [];
  for (const typeRoot of typeRoots) {
    const absoluteRoot = path.resolve(typeRoot);
    if (options.verbose) {
      console.log(
        `Checking typeRoot: ${absoluteRoot}, exists: ${fs.existsSync(absoluteRoot)}`
      );
    }
    if (fs.existsSync(absoluteRoot)) {
      const entries = fs.readdirSync(absoluteRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (
          entry.isDirectory() &&
          !entry.name.startsWith("_") &&
          !entry.name.startsWith("internal")
        ) {
          const indexPath = path.join(absoluteRoot, entry.name, "index.d.ts");
          if (fs.existsSync(indexPath)) {
            namespaceIndexFiles.push(indexPath);
            if (options.verbose) {
              console.log(`  Found namespace: ${entry.name} -> ${indexPath}`);
            }
          }
        }
      }
    }
  }

  // Combine source files, declaration files, and namespace index files
  // Note: globals.d.ts should be in the BCL bindings directory (typeRoots)
  const allFiles = [
    ...absolutePaths,
    ...declarationFiles,
    ...namespaceIndexFiles,
  ];

  const tsOptions = createCompilerOptions(options);

  // Create custom compiler host with virtual .NET module declarations
  const host = ts.createCompilerHost(tsOptions);

  // Map of .NET namespace names to their declaration file paths
  const namespaceFiles = new Map<string, string>();
  for (const indexFile of namespaceIndexFiles) {
    // Extract namespace name from path (e.g., /path/to/System/index.d.ts -> System)
    const dirName = path.basename(path.dirname(indexFile));
    namespaceFiles.set(dirName, indexFile);
  }

  // Log namespace mappings when verbose
  if (options.verbose && namespaceFiles.size > 0) {
    console.log(`Found ${namespaceFiles.size} .NET namespace declarations`);
    for (const [ns, file] of namespaceFiles) {
      console.log(`  ${ns} -> ${file}`);
    }
  }

  // Override getSourceFile to provide virtual module declarations
  const originalGetSourceFile = host.getSourceFile;
  host.getSourceFile = (
    fileName: string,
    languageVersion: ts.ScriptTarget,
    onError?: (message: string) => void,
    shouldCreateNewSourceFile?: boolean
  ): ts.SourceFile | undefined => {
    // Check if this is a .NET namespace being imported
    const baseName = path.basename(fileName, path.extname(fileName));
    const declarationPath = namespaceFiles.get(baseName);
    if (declarationPath !== undefined && fileName.endsWith(".ts")) {
      // Create a virtual source file that exports from the actual declaration
      const virtualContent = `export * from '${declarationPath.replace(/\.d\.ts$/, "")}';`;
      return ts.createSourceFile(
        fileName,
        virtualContent,
        languageVersion,
        true
      );
    }

    return originalGetSourceFile.call(
      host,
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile
    );
  };

  // Override resolveModuleNames to handle .NET imports
  const hostWithResolve = host as ts.CompilerHost & {
    resolveModuleNames: (
      moduleNames: string[],
      containingFile: string
    ) => (ts.ResolvedModule | undefined)[];
  };
  hostWithResolve.resolveModuleNames = (
    moduleNames: string[],
    containingFile: string
  ): (ts.ResolvedModule | undefined)[] => {
    return moduleNames.map((moduleName) => {
      // Debug log
      if (options.verbose) {
        console.log(`Resolving module: ${moduleName} from ${containingFile}`);
      }

      // Check if this is a .NET namespace
      const resolvedFile = namespaceFiles.get(moduleName);
      if (resolvedFile !== undefined) {
        if (options.verbose) {
          console.log(
            `  Resolved .NET namespace ${moduleName} to ${resolvedFile}`
          );
        }
        return {
          resolvedFileName: resolvedFile,
          isExternalLibraryImport: true,
        };
      }

      // Use default resolution for other modules
      const result = ts.resolveModuleName(
        moduleName,
        containingFile,
        tsOptions,
        host
      );
      return result.resolvedModule;
    });
  };

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

  // Load binding manifests (from typeRoots - for ambient globals)
  const bindings = loadBindings(typeRoots);

  // Create resolver for import-driven CLR namespace discovery
  // Uses projectRoot (not sourceRoot) to resolve packages from node_modules
  const clrResolver = createClrBindingsResolver(options.projectRoot);

  return ok({
    program,
    checker: program.getTypeChecker(),
    options,
    sourceFiles,
    metadata,
    bindings,
    clrResolver,
  });
};
