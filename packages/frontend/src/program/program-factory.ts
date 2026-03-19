/**
 * Program factory -- assembles a TsonicProgram from source files and options.
 *
 * This module contains the main `createProgram` entry point which wires up
 * the TypeScript compiler host, module resolution, bindings, and metadata.
 */

import * as ts from "typescript";
import * as path from "node:path";
import * as fs from "node:fs";
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
import {
  CORE_GLOBALS_DECLARATIONS,
  JS_SURFACE_GLOBAL_AUGMENTATIONS,
  scanForDeclarationFiles,
  collectProjectIncludedDeclarationFiles,
  createCompilerOptions,
} from "./core-declarations.js";

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
  const absolutePaths = filePaths.map((fp) => path.resolve(fp));
  const compilerContainingFile = fileURLToPath(import.meta.url);
  // creation.ts lives at: <repoRoot>/packages/frontend/src/program/creation.ts
  // repoRoot is 4 levels up from this file's directory.
  const repoRoot = path.resolve(
    path.join(path.dirname(compilerContainingFile), "../../../..")
  );

  const require = createRequire(import.meta.url);

  const readPackageName = (pkgJsonPath: string): string | undefined => {
    if (!fs.existsSync(pkgJsonPath)) return undefined;
    try {
      const parsed = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8")) as {
        readonly name?: unknown;
      };
      return typeof parsed.name === "string" ? parsed.name : undefined;
    } catch {
      return undefined;
    }
  };

  const packageRootNamespaceCache = new Map<string, string | null>();
  const packageRootModuleResolutionCache = new Map<
    string,
    ts.ResolvedModuleFull | null
  >();
  const siblingTsonicPackageRootCache = new Map<string, string | null>();
  const compilerOwnedTsonicPackageRootCache = new Map<string, string | null>();
  const projectOwnedDependencyRootCache = new Map<string, string | null>();
  const readPackageRootNamespace = (
    packageRoot: string
  ): string | undefined => {
    const cached = packageRootNamespaceCache.get(packageRoot);
    if (cached !== undefined) {
      return cached ?? undefined;
    }

    const candidates = [
      path.join(packageRoot, "index", "bindings.json"),
      path.join(packageRoot, "bindings.json"),
    ];

    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) continue;
      try {
        const parsed = JSON.parse(fs.readFileSync(candidate, "utf-8")) as {
          readonly namespace?: unknown;
        };
        if (
          typeof parsed.namespace === "string" &&
          parsed.namespace.length > 0
        ) {
          packageRootNamespaceCache.set(packageRoot, parsed.namespace);
          return parsed.namespace;
        }
      } catch {
        // Ignore malformed/non-namespace bindings candidates and continue.
      }
    }

    packageRootNamespaceCache.set(packageRoot, null);
    return undefined;
  };

  const parseTsonicModuleRequest = (
    moduleName: string
  ):
    | {
        packageName: string;
        pkgDirName: string;
        subpath: string | undefined;
      }
    | undefined => {
    const match = moduleName.match(/^@tsonic\/([^/]+)(?:\/(.+))?$/);
    if (!match) return undefined;

    const pkgDirName = match[1];
    if (!pkgDirName) return undefined;

    return {
      packageName: `@tsonic/${pkgDirName}`,
      pkgDirName,
      subpath: match[2],
    };
  };

  const resolveModuleFromPackageRoot = (
    packageRoot: string,
    subpath: string | undefined
  ): ts.ResolvedModuleFull | undefined => {
    const cacheKey = `${path.resolve(packageRoot)}::${subpath ?? "."}`;
    const cached = packageRootModuleResolutionCache.get(cacheKey);
    if (cached !== undefined) {
      return cached ?? undefined;
    }
    const buildCandidates = (
      candidateSubpath: string | undefined
    ): readonly string[] => {
      if (!candidateSubpath || candidateSubpath.length === 0) {
        return [
          path.join(packageRoot, "index.d.ts"),
          path.join(packageRoot, "index.js"),
        ];
      }

      const basePath = path.join(packageRoot, candidateSubpath);
      if (candidateSubpath.endsWith(".d.ts")) {
        return [basePath];
      }
      if (candidateSubpath.endsWith(".js")) {
        return [basePath.replace(/\.js$/, ".d.ts"), basePath];
      }

      return [
        `${basePath}.d.ts`,
        `${basePath}.js`,
        path.join(basePath, "index.d.ts"),
        path.join(basePath, "index.js"),
      ];
    };

    const remappedRootNamespaceSubpath = (() => {
      if (!subpath || subpath.length === 0) return undefined;

      const rootNamespace = readPackageRootNamespace(packageRoot);
      if (!rootNamespace) return undefined;

      if (
        subpath === `${rootNamespace}.js` ||
        subpath === `${rootNamespace}.d.ts`
      ) {
        return "index.js";
      }

      if (subpath.startsWith(`${rootNamespace}/`)) {
        return `index/${subpath.slice(rootNamespace.length + 1)}`;
      }

      return undefined;
    })();

    const candidates = [
      ...buildCandidates(subpath),
      ...buildCandidates(remappedRootNamespaceSubpath),
    ];
    const seenCandidates = new Set<string>();

    for (const candidate of candidates) {
      if (seenCandidates.has(candidate)) continue;
      seenCandidates.add(candidate);
      if (!fs.existsSync(candidate)) continue;

      const extension = candidate.endsWith(".d.ts")
        ? ts.Extension.Dts
        : candidate.endsWith(".js")
          ? ts.Extension.Js
          : candidate.endsWith(".ts")
            ? ts.Extension.Ts
            : undefined;
      if (!extension) continue;

      const resolvedModule = {
        resolvedFileName: candidate,
        extension,
        isExternalLibraryImport: true,
      };
      packageRootModuleResolutionCache.set(cacheKey, resolvedModule);
      return resolvedModule;
    }

    packageRootModuleResolutionCache.set(cacheKey, null);
    return undefined;
  };

  const resolveSiblingTsonicPackageRoot = (
    pkgDirName: string
  ): string | undefined => {
    const cached = siblingTsonicPackageRootCache.get(pkgDirName);
    if (cached !== undefined) {
      return cached ?? undefined;
    }
    const expectedName = `@tsonic/${pkgDirName}`;
    const siblingRepoRoot = path.resolve(path.join(repoRoot, "..", pkgDirName));

    const repoPackageName = readPackageName(
      path.join(siblingRepoRoot, "package.json")
    );
    if (repoPackageName === expectedName) {
      siblingTsonicPackageRootCache.set(pkgDirName, siblingRepoRoot);
      return siblingRepoRoot;
    }

    const versionsRoot = path.join(siblingRepoRoot, "versions");
    if (!fs.existsSync(versionsRoot)) return undefined;

    const versionDirs = fs
      .readdirSync(versionsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => {
        const leftNum = Number.parseInt(left, 10);
        const rightNum = Number.parseInt(right, 10);
        const leftIsNum = Number.isFinite(leftNum);
        const rightIsNum = Number.isFinite(rightNum);
        if (leftIsNum && rightIsNum) return rightNum - leftNum;
        if (leftIsNum) return -1;
        if (rightIsNum) return 1;
        return right.localeCompare(left);
      });

    for (const versionDir of versionDirs) {
      const candidateRoot = path.join(versionsRoot, versionDir);
      const candidateName = readPackageName(
        path.join(candidateRoot, "package.json")
      );
      if (candidateName === expectedName) {
        siblingTsonicPackageRootCache.set(pkgDirName, candidateRoot);
        return candidateRoot;
      }
    }

    siblingTsonicPackageRootCache.set(pkgDirName, null);
    return undefined;
  };

  const resolveCompilerOwnedTsonicPackageRoot = (
    pkgDirName: string
  ): string | undefined => {
    const cached = compilerOwnedTsonicPackageRootCache.get(pkgDirName);
    if (cached !== undefined) {
      return cached ?? undefined;
    }
    const siblingRoot = resolveSiblingTsonicPackageRoot(pkgDirName);
    if (siblingRoot) {
      compilerOwnedTsonicPackageRootCache.set(pkgDirName, siblingRoot);
      return siblingRoot;
    }

    // Fall back to compiler-owned installation (keeps stdlib typings coherent)
    try {
      const installedPkgJson = require.resolve(
        `@tsonic/${pkgDirName}/package.json`
      );
      const resolvedRoot = path.dirname(installedPkgJson);
      compilerOwnedTsonicPackageRootCache.set(pkgDirName, resolvedRoot);
      return resolvedRoot;
    } catch {
      // Package not found.
    }

    compilerOwnedTsonicPackageRootCache.set(pkgDirName, null);
    return undefined;
  };

  // Get declaration files from type roots.
  const userTypeRoots = options.typeRoots ?? [];
  const requestedTypeRoots = Array.from(
    new Set<string>([
      ...userTypeRoots,
      ...surfaceCapabilities.requiredTypeRoots,
    ])
  );
  const resolvedRequestedTypeRoots = requestedTypeRoots.map((typeRoot) => {
    const absoluteRoot = path.isAbsolute(typeRoot)
      ? typeRoot
      : path.resolve(options.projectRoot, typeRoot);

    // Prefer the project's installed package graph when the requested type root
    // already exists there. This keeps source-package imports and type roots on
    // one coherent package graph during selftests / local npm-packed validation.
    //
    // Fall back to compiler-owned packages only when the project does not have
    // the package installed at the requested path.
    const match = typeRoot.match(
      /(?:^|[/\\\\])node_modules[/\\\\]@tsonic[/\\\\]([^/\\\\]+)[/\\\\]?$/
    );
    if (match) {
      const pkgDirName = match[1];
      if (pkgDirName) {
        if (fs.existsSync(absoluteRoot)) return absoluteRoot;

        const projectOwned = resolveDependencyPackageRoot(
          options.projectRoot,
          `@tsonic/${pkgDirName}`,
          "installed-first"
        );
        if (projectOwned) return projectOwned;

        const compilerOwned = resolveCompilerOwnedTsonicPackageRoot(pkgDirName);
        if (compilerOwned) return compilerOwned;
      }
    }

    if (fs.existsSync(absoluteRoot)) return absoluteRoot;
    return absoluteRoot;
  });
  const typeRoots = resolvedRequestedTypeRoots;
  const authoritativeTsonicPackageRoots = new Map<string, string>();
  for (const typeRoot of typeRoots) {
    const packageName = readPackageName(path.join(typeRoot, "package.json"));
    if (packageName?.startsWith("@tsonic/")) {
      authoritativeTsonicPackageRoots.set(packageName, typeRoot);
    }
  }

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

  const tsOptions = createCompilerOptions(options);
  const moduleResolutionCache = ts.createModuleResolutionCache(
    options.projectRoot,
    (fileName) =>
      ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase(),
    tsOptions
  );
  const projectDeclarationFiles = collectProjectIncludedDeclarationFiles(
    options.projectRoot,
    tsOptions
  );

  const coreGlobalsVirtualPath = path.join(
    options.projectRoot,
    ".tsonic",
    "__core_globals__.d.ts"
  );
  const jsSurfaceAugmentationsVirtualPath = path.join(
    options.projectRoot,
    ".tsonic",
    "__js_surface_globals__.d.ts"
  );
  const isJsSurfaceCompilation =
    surfaceCapabilities.resolvedModes.includes("@tsonic/js");
  const virtualDeclarationSources = new Map<string, string>([
    [path.resolve(coreGlobalsVirtualPath), CORE_GLOBALS_DECLARATIONS],
    ...(isJsSurfaceCompilation
      ? [
          [
            path.resolve(jsSurfaceAugmentationsVirtualPath),
            JS_SURFACE_GLOBAL_AUGMENTATIONS,
          ] as const,
        ]
      : []),
  ]);
  const virtualDeclarationFiles = Array.from(virtualDeclarationSources.keys());

  // Combine source files, declaration files, namespace index files, and
  // compiler-owned virtual declarations.
  const allFiles = Array.from(
    new Set([
      ...absolutePaths,
      ...projectDeclarationFiles,
      ...declarationFiles,
      ...namespaceIndexFiles,
      ...virtualDeclarationFiles,
    ])
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
  const bindings = loadBindings(typeRoots);
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
