/**
 * Program creation
 */

import * as ts from "typescript";
import * as path from "node:path";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Result, ok, error } from "../types/result.js";
import { DiagnosticsCollector } from "../types/diagnostic.js";
import { CompilerOptions, TsonicProgram } from "./types.js";
import { defaultTsConfig } from "./config.js";
import { loadDotnetMetadata } from "./metadata.js";
import { loadBindings } from "./bindings.js";
import { collectTsDiagnostics } from "./diagnostics.js";
import { createClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";
import { createBinding } from "../ir/binding/index.js";

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
      // Never crawl dependency trees from a sibling checkout's node_modules.
      // In noLib mode, accidentally pulling in TypeScript's lib.*.d.ts (or other
      // ambient types) will silently change the language surface and break
      // determinism (e.g., `string.indexOf` becomes JS `number` instead of CLR `int`).
      if (entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }
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
  const compilerContainingFile = fileURLToPath(import.meta.url);
  // creation.ts lives at: <repoRoot>/packages/frontend/src/program/creation.ts
  // repoRoot is 4 levels up from this file's directory.
  const repoRoot = path.resolve(
    path.join(path.dirname(compilerContainingFile), "../../../..")
  );

  const require = createRequire(import.meta.url);

  const resolveTsonicPackageRoot = (pkgDirName: string): string | undefined => {
    const siblingRoot = path.resolve(path.join(repoRoot, "..", pkgDirName));
    const pkgJson = path.join(siblingRoot, "package.json");
    if (fs.existsSync(pkgJson)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(pkgJson, "utf-8")) as {
          readonly name?: unknown;
        };
        if (parsed.name === `@tsonic/${pkgDirName}`) return siblingRoot;
      } catch {
        // Ignore invalid package.json.
      }
    }

    // Fall back to compiler-owned installation (keeps stdlib typings coherent)
    try {
      const installedPkgJson = require.resolve(`@tsonic/${pkgDirName}/package.json`);
      return path.dirname(installedPkgJson);
    } catch {
      // Package not found.
    }

    return undefined;
  };

  // Mandatory, compiler-owned type root (never optional).
  // Prefer sibling checkout (dev) or fall back to installed package.
  const mandatoryTypeRoot = resolveTsonicPackageRoot("globals");

  // Get declaration files from type roots
  // Inject mandatory type root first, then user-provided roots
  const userTypeRoots = options.typeRoots ?? [];
  const resolvedUserTypeRoots = userTypeRoots.map((typeRoot) => {
    const absoluteRoot = path.isAbsolute(typeRoot)
      ? typeRoot
      : path.resolve(options.projectRoot, typeRoot);

    if (fs.existsSync(absoluteRoot)) return absoluteRoot;

    // If the typeRoot points at a missing @tsonic package under node_modules,
    // try to resolve it from the compiler install or a sibling checkout.
    const match = typeRoot.match(
      /(?:^|[/\\\\])node_modules[/\\\\]@tsonic[/\\\\]([^/\\\\]+)[/\\\\]?$/
    );
    if (!match) return absoluteRoot;

    const pkgDirName = match[1];
    if (!pkgDirName) return absoluteRoot;

    return resolveTsonicPackageRoot(pkgDirName) ?? absoluteRoot;
  });
  const typeRoots = options.useStandardLib
    ? resolvedUserTypeRoots
    : mandatoryTypeRoot
      ? Array.from(new Set([mandatoryTypeRoot, ...resolvedUserTypeRoots]))
      : resolvedUserTypeRoots.length > 0
        ? resolvedUserTypeRoots
        : ["node_modules/@tsonic/globals"];

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

      // @tsonic/* packages are project dependencies. Resolve them from the project
      // root so a global `tsonic` install can compile projects that install
      // @tsonic/* into their local node_modules (out-of-box experience).
      if (moduleName.startsWith("@tsonic/")) {
        // Resolve from project root first (works for global installs).
        // Note: containingFile can be a declaration file coming from a sibling
        // checkout during development; resolving relative to that path would skip
        // the project's node_modules entirely.
        const projectResolveFile = path.join(
          options.projectRoot,
          "__tsonic_resolver__.ts"
        );
        const projectResult = ts.resolveModuleName(
          moduleName,
          projectResolveFile,
          tsOptions,
          host
        );
        if (projectResult.resolvedModule) return projectResult.resolvedModule;

        // Development fallback: allow resolving from sibling checkouts
        // (e.g. ../dotnet, ../core) when present.
        const match = moduleName.match(/^@tsonic\/([^/]+)\/(.+)$/);
        if (match) {
          const pkgDirName = match[1];
          const subpath = match[2];
          if (!pkgDirName || !subpath) return undefined;

          const siblingRoot = path.resolve(path.join(repoRoot, "..", pkgDirName));

          const jsPath = path.join(siblingRoot, subpath);
          const dtsPath = jsPath.endsWith(".js")
            ? jsPath.replace(/\.js$/, ".d.ts")
            : `${jsPath}.d.ts`;

          if (fs.existsSync(dtsPath)) {
            return {
              resolvedFileName: dtsPath,
              extension: ts.Extension.Dts,
              isExternalLibraryImport: true,
            };
          }
          if (fs.existsSync(jsPath)) {
            return {
              resolvedFileName: jsPath,
              extension: ts.Extension.Js,
              isExternalLibraryImport: true,
            };
          }
        }

        // Fall back to the compiler's own installation (useful in dev setups
        // where the project hasn't installed @tsonic/* yet).
        const result = ts.resolveModuleName(
          moduleName,
          compilerContainingFile,
          tsOptions,
          host
        );
        if (result.resolvedModule) return result.resolvedModule;

        return undefined;
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

  // User source files (non-declaration files from input paths)
  const sourceFiles = program
    .getSourceFiles()
    .filter(
      (sf) => !sf.isDeclarationFile && absolutePaths.includes(sf.fileName)
    );

  // Declaration files for TypeRegistry - include all @tsonic/* package declarations
  // This includes:
  // - @tsonic/globals (globals like String, Array, Promise)
  // - @tsonic/dotnet (BCL type definitions like String$instance, Array$instance)
  // - @tsonic/core (type aliases like int, long, etc.)
  // - Any other @tsonic/* dependencies
  // We need all of these for proper heritage chain resolution (e.g., String extends String$instance)
  const packageRootCache = new Map<string, boolean>();
  const isInTsonicPackage = (filePath: string): boolean => {
    let dir = path.dirname(filePath);

    while (true) {
      const cached = packageRootCache.get(dir);
      if (cached !== undefined) return cached;

      const pkgJson = path.join(dir, "package.json");
      if (fs.existsSync(pkgJson)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(pkgJson, "utf-8")) as {
            readonly name?: unknown;
          };
          const ok =
            typeof parsed.name === "string" && parsed.name.startsWith("@tsonic/");
          packageRootCache.set(dir, ok);
          return ok;
        } catch {
          packageRootCache.set(dir, false);
          return false;
        }
      }

      const parent = path.dirname(dir);
      if (parent === dir) {
        packageRootCache.set(dir, false);
        return false;
      }
      dir = parent;
    }
  };

  const declarationSourceFiles = program
    .getSourceFiles()
    .filter((sf) => sf.isDeclarationFile && isInTsonicPackage(sf.fileName));

  // Load .NET metadata files
  const metadata = loadDotnetMetadata(typeRoots);

  // Load binding manifests (from typeRoots - for ambient globals)
  const bindings = loadBindings(typeRoots);
  // Compiler-owned builtin: map TS `Error` to CLR `System.Exception`.
  // This keeps `throw new Error(...)` usable in noLib mode without requiring
  // consumers to import Exception explicitly.
  bindings.addBindings("tsonic:builtins", {
    bindings: {
      Error: {
        kind: "global",
        assembly: "System.Private.CoreLib",
        type: "System.Exception",
      },
    },
  });

  // Create resolver for import-driven CLR namespace discovery
  // Uses projectRoot (not sourceRoot) to resolve packages from node_modules
  const clrResolver = createClrBindingsResolver(options.projectRoot);

  // Create binding layer for symbol resolution
  // This replaces direct checker API calls throughout the pipeline
  const checker = program.getTypeChecker();
  const binding = createBinding(checker);

  return ok({
    program,
    checker,
    options,
    sourceFiles,
    declarationSourceFiles,
    metadata,
    bindings,
    clrResolver,
    binding,
  });
};
