/**
 * Program assembly -- wires up the TS compiler host, virtual declarations,
 * module resolution dispatch, and the final TsonicProgram construction.
 */

import * as ts from "typescript";
import * as fs from "node:fs";
import * as path from "node:path";
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
import {
  findContainingSourcePackageRoot,
  resolveSourcePackageAliasTarget,
  resolveSourcePackageImport,
  resolveSourcePackageImportFromPackageRoot,
} from "../resolver/source-package-resolution.js";
import {
  addDiagnostic,
  createDiagnostic,
  createDiagnosticsCollector,
} from "../types/diagnostic.js";
import { resolveDependencyPackageRoot } from "./package-roots.js";
import {} from "./core-declarations.js";
import {
  parseTsonicModuleRequest,
  createReadPackageRootNamespace,
  createResolveModuleFromPackageRoot,
} from "./module-resolution.js";
import { discoverProgramInputs } from "./program-input-discovery.js";
import { readSourcePackageMetadata } from "./source-package-metadata.js";
import { resolveSourceBackedBindingFiles } from "./source-binding-imports.js";

const canonicalizeFilePath = (filePath: string): string => {
  const normalizedPath = path.resolve(filePath);
  try {
    return fs.realpathSync(normalizedPath);
  } catch {
    return normalizedPath;
  }
};

const resolveCommonRootDir = (paths: readonly string[]): string => {
  const [first, ...remaining] = paths;
  if (!first) {
    throw new Error("resolveCommonRootDir requires at least one path");
  }

  const rest = remaining.map(canonicalizeFilePath);
  let current = canonicalizeFilePath(first);

  for (;;) {
    const containsAll = rest.every((candidate) => {
      const relative = path.relative(current, candidate);
      return (
        relative === "" ||
        (!relative.startsWith("..") && !path.isAbsolute(relative))
      );
    });

    if (containsAll) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return current;
    }
    current = parent;
  }
};

const dedupeCanonicalFilePaths = (
  filePaths: readonly string[]
): readonly string[] => {
  const uniquePaths: string[] = [];
  const seen = new Set<string>();

  for (const filePath of filePaths) {
    const canonicalPath = canonicalizeFilePath(filePath);
    if (seen.has(canonicalPath)) {
      continue;
    }

    seen.add(canonicalPath);
    uniquePaths.push(canonicalPath);
  }

  return uniquePaths;
};

const createSourceFilePathSet = (
  filePaths: readonly string[]
): ReadonlySet<string> => {
  const canonicalPaths = new Set<string>();

  for (const filePath of filePaths) {
    canonicalPaths.add(canonicalizeFilePath(filePath));
  }

  return canonicalPaths;
};

const findAuthoritativePackageRootForImport = (
  importSpecifier: string,
  authoritativeTsonicPackageRoots: ReadonlyMap<string, string>
): string | undefined => {
  let bestMatch: string | undefined;

  for (const [packageName, packageRoot] of authoritativeTsonicPackageRoots) {
    if (
      importSpecifier === packageName ||
      importSpecifier.startsWith(`${packageName}/`)
    ) {
      if (!bestMatch || packageName.length > bestMatch.length) {
        bestMatch = packageName;
      }

      if (packageName === importSpecifier) {
        return packageRoot;
      }
    }
  }

  return bestMatch ? authoritativeTsonicPackageRoots.get(bestMatch) : undefined;
};

const toTsSourceResolvedModule = (
  resolvedPath: string
): ts.ResolvedModuleFull => ({
  resolvedFileName: resolvedPath,
  extension: resolvedPath.endsWith(".mts")
    ? ts.Extension.Mts
    : resolvedPath.endsWith(".cts")
      ? ts.Extension.Cts
      : ts.Extension.Ts,
  isExternalLibraryImport: false,
});

/**
 * Create a Tsonic program from TypeScript source files
 */
export const createProgram = (
  filePaths: readonly string[],
  options: CompilerOptions
): Result<TsonicProgram, DiagnosticsCollector> => {
  const surface = options.surface ?? "clr";
  const initialSurfaceResolveOptions = {
    projectRoot: options.projectRoot,
  };
  let surfaceCapabilities = resolveSurfaceCapabilities(
    surface,
    initialSurfaceResolveOptions
  );
  const packageRootNamespaceCache = new Map<string, string | null>();
  const packageRootModuleResolutionCache = new Map<
    string,
    ts.ResolvedModuleFull | null
  >();
  const projectOwnedDependencyRootCache = new Map<string, string | null>();

  const readPkgRootNamespace = createReadPackageRootNamespace(
    packageRootNamespaceCache
  );
  const resolveModuleFromPackageRoot = createResolveModuleFromPackageRoot(
    packageRootModuleResolutionCache,
    readPkgRootNamespace
  );
  let discovery = discoverProgramInputs(
    filePaths,
    options,
    surfaceCapabilities
  );
  const resolveFinalSurfaceOptions = () => ({
    projectRoot: options.projectRoot,
    authoritativePackageRoots: discovery.authoritativeTsonicPackageRoots,
  });

  if (
    surface !== "clr" &&
    !hasResolvedSurfaceProfile(surface, initialSurfaceResolveOptions)
  ) {
    if (!hasResolvedSurfaceProfile(surface, resolveFinalSurfaceOptions())) {
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
  }

  const finalSurfaceCapabilities = resolveSurfaceCapabilities(
    surface,
    resolveFinalSurfaceOptions()
  );
  const surfaceCapabilitiesChanged =
    JSON.stringify(finalSurfaceCapabilities.resolvedModes) !==
      JSON.stringify(surfaceCapabilities.resolvedModes) ||
    JSON.stringify(finalSurfaceCapabilities.requiredTypeRoots) !==
      JSON.stringify(surfaceCapabilities.requiredTypeRoots) ||
    finalSurfaceCapabilities.includesClr !== surfaceCapabilities.includesClr;

  if (surfaceCapabilitiesChanged) {
    surfaceCapabilities = finalSurfaceCapabilities;
    discovery = discoverProgramInputs(filePaths, options, surfaceCapabilities);
  } else {
    surfaceCapabilities = finalSurfaceCapabilities;
  }

  const {
    absolutePaths: discoveredAbsolutePaths,
    typeRoots,
    authoritativeTsonicPackageRoots,
    namespaceIndexFiles,
    declarationModuleAliases,
    allFiles: discoveredAllFiles,
    tsOptions,
  } = discovery;
  const bindingRoots = dedupeCanonicalFilePaths([
    ...typeRoots,
    ...authoritativeTsonicPackageRoots.values(),
  ]);
  const bindings = loadBindings(bindingRoots);
  const bindingSourceFiles = resolveSourceBackedBindingFiles(
    bindings,
    path.join(options.projectRoot, "__tsonic_source_bindings__.ts"),
    options.projectRoot,
    surface,
    authoritativeTsonicPackageRoots
  );
  if (!bindingSourceFiles.ok) {
    return error(
      addDiagnostic(createDiagnosticsCollector(), bindingSourceFiles.error)
    );
  }
  const absolutePaths = dedupeCanonicalFilePaths(discoveredAbsolutePaths);
  const allFiles = dedupeCanonicalFilePaths([
    ...discoveredAllFiles,
    ...bindingSourceFiles.value,
  ]);
  if (typeof tsOptions.rootDir === "string" && absolutePaths.length > 0) {
    tsOptions.rootDir = resolveCommonRootDir([
      tsOptions.rootDir,
      ...absolutePaths,
    ]);
  }
  const moduleResolutionCache = ts.createModuleResolutionCache(
    options.projectRoot,
    (fileName) =>
      ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
    tsOptions
  );

  // Create custom compiler host with virtual .NET module declarations
  const host = ts.createCompilerHost(tsOptions);
  const originalRealpath = host.realpath?.bind(host);
  host.realpath = (fileName: string): string => {
    if (tsOptions.preserveSymlinks) {
      return path.resolve(fileName);
    }
    if (originalRealpath) {
      return originalRealpath(fileName);
    }
    return path.resolve(fileName);
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
      const resolveSourcePackageAliasModule = (): ts.ResolvedModuleFull | undefined => {
        const candidateRoots = new Set<string>([
          ...authoritativeTsonicPackageRoots.values(),
        ]);
        const containingSourcePackageRoot =
          findContainingSourcePackageRoot(containingFile);
        if (containingSourcePackageRoot) {
          candidateRoots.add(containingSourcePackageRoot);
        }

        for (const packageRoot of candidateRoots) {
          const metadata = readSourcePackageMetadata(packageRoot);
          const aliasTarget = metadata?.moduleAliases[moduleName];
          if (!aliasTarget) {
            continue;
          }

          const resolved = resolveSourcePackageAliasTarget(
            aliasTarget,
            packageRoot,
            options.surface,
            options.projectRoot
          );

          if (!resolved.ok || !resolved.value) {
            continue;
          }

          return toTsSourceResolvedModule(resolved.value.resolvedPath);
        }

        return undefined;
      };

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

        // 2) Prefer the project's installed source-package graph. Direct imports
        // must resolve through the consuming project's package graph.
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

        // 3) Prefer the project's installed dependency graph so direct source
        // imports stay coherent with the package roots the consumer installed.
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

        // 4) Final project-installed resolution through TypeScript itself.
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

        return undefined;
      }

      const authoritativePackageRoot = findAuthoritativePackageRootForImport(
        moduleName,
        authoritativeTsonicPackageRoots
      );
      const sourcePackage =
        authoritativePackageRoot !== undefined
          ? resolveSourcePackageImportFromPackageRoot(
              moduleName,
              authoritativePackageRoot,
              options.surface,
              options.projectRoot
            )
          : resolveSourcePackageImport(
              moduleName,
              containingFile,
              options.surface,
              options.projectRoot
            );
      if (!sourcePackage.ok) {
        return undefined;
      }
      if (sourcePackage.value) {
        return toTsSourceResolvedModule(sourcePackage.value.resolvedPath);
      }

      const aliasedSourcePackage = resolveSourcePackageAliasModule();
      if (aliasedSourcePackage) {
        return aliasedSourcePackage;
      }

      const declarationAlias = declarationModuleAliases.get(moduleName);
      if (declarationAlias) {
        const authoritativeAliasRoot = findAuthoritativePackageRootForImport(
          declarationAlias.targetSpecifier,
          authoritativeTsonicPackageRoots
        );
        const redirectedSourcePackage =
          authoritativeAliasRoot !== undefined
            ? resolveSourcePackageAliasTarget(
                declarationAlias.targetSpecifier,
                authoritativeAliasRoot,
                options.surface,
                options.projectRoot
              )
            : declarationAlias.targetSpecifier === "." ||
                declarationAlias.targetSpecifier.startsWith("./")
              ? resolveSourcePackageAliasTarget(
                  declarationAlias.targetSpecifier,
                  path.dirname(declarationAlias.declarationFile),
                  options.surface,
                  options.projectRoot
                )
              : resolveSourcePackageImport(
                  declarationAlias.targetSpecifier,
                  containingFile,
                  options.surface,
                  options.projectRoot
                );
        if (redirectedSourcePackage.ok && redirectedSourcePackage.value) {
          return toTsSourceResolvedModule(
            redirectedSourcePackage.value.resolvedPath
          );
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
  const sourceFilePaths = createSourceFilePathSet(absolutePaths);
  const isImportedSourcePackageSourceFile = (filePath: string): boolean => {
    const normalizedFilePath = canonicalizeFilePath(filePath);
    if (sourceFilePaths.has(normalizedFilePath)) {
      return true;
    }

    return findContainingSourcePackageRoot(normalizedFilePath) !== undefined;
  };
  const seenSourceFilePaths = new Set<string>();
  const sourceFiles = program
    .getSourceFiles()
    .filter((sf) => {
      if (
        sf.isDeclarationFile ||
        !isImportedSourcePackageSourceFile(sf.fileName)
      ) {
        return false;
      }

      const canonicalFileName = canonicalizeFilePath(sf.fileName);
      if (seenSourceFilePaths.has(canonicalFileName)) {
        return false;
      }

      seenSourceFilePaths.add(canonicalFileName);
      return true;
    });

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
    authoritativeTsonicPackageRoots,
    declarationModuleAliases,
    sourceFiles,
    declarationSourceFiles,
    metadata,
    bindings,
    clrResolver,
    binding,
  });
};
