/**
 * Program assembly -- wires up the TS compiler host, virtual declarations,
 * module resolution dispatch, and the final TsonicProgram construction.
 */

import * as ts from "typescript";
import * as path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Result, ok, error } from "../types/result.js";
import { DiagnosticsCollector } from "../types/diagnostic.js";
import { CompilerOptions, TsonicProgram } from "./types.js";
import { loadDotnetMetadata } from "./metadata.js";
import { loadBindings } from "./bindings.js";
import { collectTsDiagnostics } from "./diagnostics.js";
import { createClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";
import { createBinding } from "../ir/binding/index.js";
import {
  hasResolvedSurfaceProfile,
  resolveSurfaceCapabilities,
} from "../surface/profiles.js";
import { resolveSourcePackageImport } from "../resolver/source-package-resolution.js";
import {
  addDiagnostic,
  createDiagnostic,
  createDiagnosticsCollector,
} from "../types/diagnostic.js";
import { resolveDependencyPackageRoot } from "./package-roots.js";
import {} from "./core-declarations.js";
import {
  parseTsonicModuleRequest,
  createResolveSiblingTsonicPackageRoot,
  createResolveCompilerOwnedTsonicPackageRoot,
  createReadPackageRootNamespace,
  createResolveModuleFromPackageRoot,
} from "./module-resolution.js";
import { discoverProgramInputs } from "./program-input-discovery.js";

const resolveMonorepoRoot = (): string => {
  const envRoot = process.env.TSONIC_REPO_ROOT?.trim();
  if (envRoot) {
    return path.resolve(envRoot);
  }

  const compilerContainingFile = fileURLToPath(import.meta.url);
  return path.resolve(
    path.join(path.dirname(compilerContainingFile), "../../../..")
  );
};

/**
 * Create a Tsonic program from TypeScript source files
 */
export const createProgram = (
  filePaths: readonly string[],
  options: CompilerOptions
): Result<TsonicProgram, DiagnosticsCollector> => {
  const surface = options.surface ?? "clr";
  if (
    surface !== "clr" &&
    !hasResolvedSurfaceProfile(surface, {
      projectRoot: options.projectRoot,
    })
  ) {
    return error(
      addDiagnostic(
        createDiagnosticsCollector(),
        createDiagnostic(
          "TSN1004",
          "error",
          `Surface '${surface}' is not a valid ambient surface package.`,
          undefined,
          "Custom surfaces must provide tsonic.surface.json. Use '@tsonic/js' for JS ambient APIs, and add normal packages separately."
        )
      )
    );
  }
  const surfaceCapabilities = resolveSurfaceCapabilities(surface, {
    projectRoot: options.projectRoot,
  });
  const compilerContainingFile = fileURLToPath(import.meta.url);
  const repoRoot = resolveMonorepoRoot();

  const require = createRequire(import.meta.url);

  const packageRootNamespaceCache = new Map<string, string | null>();
  const packageRootModuleResolutionCache = new Map<
    string,
    ts.ResolvedModuleFull | null
  >();
  const siblingTsonicPackageRootCache = new Map<string, string | null>();
  const compilerOwnedTsonicPackageRootCache = new Map<string, string | null>();
  const projectOwnedDependencyRootCache = new Map<string, string | null>();

  const readPkgRootNamespace = createReadPackageRootNamespace(
    packageRootNamespaceCache
  );
  const resolveModuleFromPackageRoot = createResolveModuleFromPackageRoot(
    packageRootModuleResolutionCache,
    readPkgRootNamespace
  );
  const resolveSiblingTsonicPackageRoot = createResolveSiblingTsonicPackageRoot(
    siblingTsonicPackageRootCache,
    repoRoot
  );
  const resolveCompilerOwnedTsonicPackageRoot =
    createResolveCompilerOwnedTsonicPackageRoot(
      compilerOwnedTsonicPackageRootCache,
      resolveSiblingTsonicPackageRoot,
      require
    );

  const {
    absolutePaths,
    typeRoots,
    authoritativeTsonicPackageRoots,
    namespaceIndexFiles,
    virtualDeclarationSources,
    allFiles,
    tsOptions,
  } = discoverProgramInputs(
    filePaths,
    options,
    surfaceCapabilities,
    (pkgDirName) => resolveCompilerOwnedTsonicPackageRoot(pkgDirName) ?? null
  );
  const bindings = loadBindings(typeRoots);
  const moduleResolutionCache = ts.createModuleResolutionCache(
    options.projectRoot,
    (fileName) =>
      ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
    tsOptions
  );

  // Create custom compiler host with virtual .NET module declarations
  const host = ts.createCompilerHost(tsOptions);
  const normalizeVirtualFilePath = (filePath: string): string =>
    path.resolve(filePath);
  const isPackageCoreGlobalsFile = (filePath: string): boolean =>
    path.basename(filePath) === "core-globals.d.ts";
  const getVirtualDeclarationText = (filePath: string): string | undefined =>
    virtualDeclarationSources.get(normalizeVirtualFilePath(filePath));

  const originalFileExists = host.fileExists;
  host.fileExists = (fileName: string): boolean => {
    if (getVirtualDeclarationText(fileName) !== undefined) return true;
    return originalFileExists(fileName);
  };

  const originalReadFile = host.readFile;
  host.readFile = (fileName: string): string | undefined => {
    const virtualText = getVirtualDeclarationText(fileName);
    if (virtualText !== undefined) return virtualText;
    if (isPackageCoreGlobalsFile(fileName)) return "export {};\n";
    return originalReadFile(fileName);
  };

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
    const virtualText = getVirtualDeclarationText(fileName);
    if (virtualText !== undefined) {
      return ts.createSourceFile(fileName, virtualText, languageVersion, true);
    }
    if (isPackageCoreGlobalsFile(fileName)) {
      return ts.createSourceFile(
        fileName,
        "export {};\n",
        languageVersion,
        true
      );
    }

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

      // @tsonic/* packages must stay on a single coherent package graph for the
      // active compilation. Mixing:
      //   - compiler/typeRoot-owned declarations, and
      //   - project-local installed copies
      // produces nominal identity splits inside TypeScript (e.g. two different
      // Task / Stream / Exception hierarchies), which then surface as impossible
      // overload failures and self-incompatible types.
      if (moduleName.startsWith("@tsonic/")) {
        const request = parseTsonicModuleRequest(moduleName);

        // 1) If this package is already part of the active type-root/surface
        // graph, always resolve to that exact root — even for user source files.
        if (request) {
          const authoritativeRoot = authoritativeTsonicPackageRoots.get(
            request.packageName
          );
          if (authoritativeRoot) {
            const resolved = resolveModuleFromPackageRoot(
              authoritativeRoot,
              request.subpath
            );
            if (resolved) return resolved;
          }
        }

        // 2) In local monorepo / compiler-install development, prefer the
        // project's installed source-package graph before consulting compiler-
        // owned fallback packages. This keeps direct imports coherent with the
        // package graph the current project actually installed and packed.
        const projectResolveFile = path.join(
          options.projectRoot,
          "__tsonic_resolver__.ts"
        );
        const projectSourcePackage = resolveSourcePackageImport(
          moduleName,
          projectResolveFile,
          options.surface,
          options.projectRoot
        );
        if (projectSourcePackage.ok && projectSourcePackage.value) {
          return {
            resolvedFileName: projectSourcePackage.value.resolvedPath,
            extension: projectSourcePackage.value.resolvedPath.endsWith(".mts")
              ? ts.Extension.Mts
              : projectSourcePackage.value.resolvedPath.endsWith(".cts")
                ? ts.Extension.Cts
                : ts.Extension.Ts,
            isExternalLibraryImport: false,
          };
        }

        // 3) Prefer the project's installed dependency graph before consulting
        // compiler-owned sibling packages. This keeps direct source imports
        // coherent with surface declarations that already came from installed
        // package roots.
        if (request) {
          let projectOwnedRoot = projectOwnedDependencyRootCache.get(
            request.packageName
          );
          if (projectOwnedRoot === undefined) {
            projectOwnedRoot =
              resolveDependencyPackageRoot(
                options.projectRoot,
                request.packageName,
                "installed-first"
              ) ?? null;
            projectOwnedDependencyRootCache.set(
              request.packageName,
              projectOwnedRoot
            );
          }
          if (projectOwnedRoot) {
            const resolved = resolveModuleFromPackageRoot(
              projectOwnedRoot,
              request.subpath
            );
            if (resolved) return resolved;
          }
        }

        // 4) Fall back to compiler-owned sibling / compiler-install packages.
        if (request) {
          const compilerOwnedRoot = resolveCompilerOwnedTsonicPackageRoot(
            request.pkgDirName
          );
          if (compilerOwnedRoot) {
            const resolved = resolveModuleFromPackageRoot(
              compilerOwnedRoot,
              request.subpath
            );
            if (resolved) return resolved;
          }
        }

        // 5) Final project-installed resolution through TypeScript itself.
        // Note: containingFile can be a declaration file coming from a sibling
        // checkout during development; resolving relative to that path would skip
        // the project's node_modules entirely.
        const projectResult = ts.resolveModuleName(
          moduleName,
          projectResolveFile,
          tsOptions,
          host,
          moduleResolutionCache
        );
        if (projectResult.resolvedModule) return projectResult.resolvedModule;

        // 6) Final resolution fallback through the compiler's own module graph.
        const result = ts.resolveModuleName(
          moduleName,
          compilerContainingFile,
          tsOptions,
          host,
          moduleResolutionCache
        );
        if (result.resolvedModule) return result.resolvedModule;

        return undefined;
      }

      const sourcePackage = resolveSourcePackageImport(
        moduleName,
        containingFile,
        options.surface,
        options.projectRoot
      );
      if (!sourcePackage.ok) {
        return undefined;
      }
      if (sourcePackage.value) {
        return {
          resolvedFileName: sourcePackage.value.resolvedPath,
          extension: sourcePackage.value.resolvedPath.endsWith(".mts")
            ? ts.Extension.Mts
            : sourcePackage.value.resolvedPath.endsWith(".cts")
              ? ts.Extension.Cts
              : ts.Extension.Ts,
          isExternalLibraryImport: false,
        };
      }

      const moduleBinding = bindings.getBinding(moduleName);
      if (moduleBinding?.kind === "module" && moduleBinding.sourceImport) {
        const redirectedSourcePackage = resolveSourcePackageImport(
          moduleBinding.sourceImport,
          containingFile,
          options.surface,
          options.projectRoot
        );
        if (redirectedSourcePackage.ok && redirectedSourcePackage.value) {
          return {
            resolvedFileName: redirectedSourcePackage.value.resolvedPath,
            extension: redirectedSourcePackage.value.resolvedPath.endsWith(
              ".mts"
            )
              ? ts.Extension.Mts
              : redirectedSourcePackage.value.resolvedPath.endsWith(".cts")
                ? ts.Extension.Cts
                : ts.Extension.Ts,
            isExternalLibraryImport: false,
          };
        }
      }

      // Use default resolution for other modules
      const result = ts.resolveModuleName(
        moduleName,
        containingFile,
        tsOptions,
        host,
        moduleResolutionCache
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

  // Declaration files for TypeRegistry:
  // include all declarations in the program. ProgramContext later filters out
  // CLR metadata packages that are represented in the CLR catalog.
  // This keeps surface support generic: custom non-@tsonic surface packages are
  // available to the frontend without any package-name allowlist.
  const declarationSourceFiles = program
    .getSourceFiles()
    .filter((sf) => sf.isDeclarationFile);

  // Load .NET metadata files
  const metadata = loadDotnetMetadata(typeRoots);

  // Load binding manifests (from typeRoots - for ambient globals)
  // Compiler-owned builtin: map TS `Error` to CLR `System.Exception`.
  // This keeps `throw new Error(...)` usable in noLib mode without requiring
  // consumers to import Exception explicitly.
  if (!bindings.getBinding("Error")) {
    bindings.addBindings("tsonic:builtins", {
      bindings: {
        Error: {
          kind: "global",
          assembly: "System.Private.CoreLib",
          type: "System.Exception",
          typeSemantics: {
            contributesTypeIdentity: true,
          },
        },
      },
    });
  }

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
