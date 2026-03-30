import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import type { CompilerOptions } from "./types.js";
import { resolveDependencyPackageRoot } from "./package-roots.js";
import {
  CORE_GLOBALS_DECLARATIONS,
  JS_SURFACE_GLOBAL_AUGMENTATIONS,
  collectProjectIncludedDeclarationFiles,
  createCompilerOptions,
  scanForDeclarationFiles,
} from "./core-declarations.js";
import {
  discoverDeclarationModuleAliases,
  type DeclarationModuleAlias,
} from "./declaration-module-aliases.js";
import { readPackageName } from "./module-resolution.js";
import { readSourcePackageMetadata } from "./source-package-metadata.js";

type SurfaceCapabilitiesLike = {
  readonly requiredTypeRoots: readonly string[];
  readonly resolvedModes: readonly string[];
};

const installedSourcePackageIndexCache = new Map<
  string,
  ReadonlyMap<string, string>
>();

const canonicalizeRootDirPath = (filePath: string): string => {
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
  const rest = remaining.map(canonicalizeRootDirPath);
  let current = canonicalizeRootDirPath(first);

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

const readSourcePackageAmbientPaths = (
  packageRoot: string
): readonly string[] => {
  return readSourcePackageMetadata(packageRoot)?.ambientPaths ?? [];
};

const readSourcePackageExportPaths = (
  packageRoot: string
): readonly string[] => {
  return readSourcePackageMetadata(packageRoot)?.exportPaths ?? [];
};

const collectSourcePackageModuleAliases = (
  packageRoots: readonly string[]
): ReadonlyMap<string, DeclarationModuleAlias> => {
  const aliases = new Map<string, DeclarationModuleAlias>();

  for (const packageRoot of packageRoots) {
    const metadata = readSourcePackageMetadata(packageRoot);
    if (!metadata) {
      continue;
    }

    for (const [specifier, targetSpecifier] of Object.entries(
      metadata.moduleAliases
    )) {
      if (aliases.has(specifier)) {
        continue;
      }

      aliases.set(specifier, {
        targetSpecifier,
        declarationFile: path.join(metadata.packageRoot, "tsonic.package.json"),
      });
    }
  }

  return aliases;
};

const readTsonicDependencyNames = (packageRoot: string): readonly string[] => {
  const packageJsonPath = path.join(packageRoot, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as {
      readonly dependencies?: Record<string, unknown>;
      readonly peerDependencies?: Record<string, unknown>;
      readonly optionalDependencies?: Record<string, unknown>;
    };

    return Array.from(
      new Set(
        [
          ...Object.keys(parsed.dependencies ?? {}),
          ...Object.keys(parsed.peerDependencies ?? {}),
          ...Object.keys(parsed.optionalDependencies ?? {}),
        ].filter((packageName) => packageName.length > 0)
      )
    );
  } catch {
    return [];
  }
};

const addInstalledSourcePackageCandidate = (
  packageIndex: Map<string, string>,
  packageRoot: string
): void => {
  if (!readSourcePackageMetadata(packageRoot)) {
    return;
  }

  const packageName = readPackageName(path.join(packageRoot, "package.json"));
  if (!packageName || packageIndex.has(packageName)) {
    return;
  }

  packageIndex.set(packageName, packageRoot);
};

const scanInstalledSourcePackages = (
  projectRoot: string
): ReadonlyMap<string, string> => {
  const normalizedRoot = path.resolve(projectRoot);
  const cached = installedSourcePackageIndexCache.get(normalizedRoot);
  if (cached !== undefined) {
    return cached;
  }

  const packageIndex = new Map<string, string>();
  let currentDir = normalizedRoot;

  for (;;) {
    const nodeModulesRoot = path.join(currentDir, "node_modules");
    if (fs.existsSync(nodeModulesRoot)) {
      const entries = fs.readdirSync(nodeModulesRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        if (entry.name.startsWith("@")) {
          const scopeRoot = path.join(nodeModulesRoot, entry.name);
          const scopedEntries = fs.readdirSync(scopeRoot, {
            withFileTypes: true,
          });
          for (const scopedEntry of scopedEntries) {
            if (!scopedEntry.isDirectory()) {
              continue;
            }
            addInstalledSourcePackageCandidate(
              packageIndex,
              path.join(scopeRoot, scopedEntry.name)
            );
          }
          continue;
        }

        addInstalledSourcePackageCandidate(
          packageIndex,
          path.join(nodeModulesRoot, entry.name)
        );
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  installedSourcePackageIndexCache.set(normalizedRoot, packageIndex);
  return packageIndex;
};

export type ProgramInputDiscovery = {
  readonly absolutePaths: readonly string[];
  readonly typeRoots: readonly string[];
  readonly authoritativeTsonicPackageRoots: ReadonlyMap<string, string>;
  readonly namespaceIndexFiles: readonly string[];
  readonly declarationModuleAliases: ReadonlyMap<string, DeclarationModuleAlias>;
  readonly virtualDeclarationSources: ReadonlyMap<string, string>;
  readonly allFiles: readonly string[];
  readonly tsOptions: ts.CompilerOptions;
};

export const discoverProgramInputs = (
  filePaths: readonly string[],
  options: CompilerOptions,
  surfaceCapabilities: SurfaceCapabilitiesLike
): ProgramInputDiscovery => {
  const absolutePaths = filePaths.map((filePath) => path.resolve(filePath));
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

    const match = typeRoot.match(
      /(?:^|[/\\\\])node_modules[/\\\\]@tsonic[/\\\\]([^/\\\\]+)[/\\\\]?$/
    );
    if (match) {
      const pkgDirName = match[1];
      if (pkgDirName) {
        if (fs.existsSync(absoluteRoot)) {
          return canonicalizeRootDirPath(absoluteRoot);
        }

        const projectOwned = resolveDependencyPackageRoot(
          options.projectRoot,
          `@tsonic/${pkgDirName}`,
          "installed-first"
        );
        if (projectOwned) return projectOwned;
      }
    }

    if (fs.existsSync(absoluteRoot)) {
      return canonicalizeRootDirPath(absoluteRoot);
    }
    return absoluteRoot;
  });
  const authoritativeTsonicPackageRoots = new Map<string, string>();
  const explicitAuthoritativeRoots = new Map<string, string>();
  const currentProjectPackageName = readPackageName(
    path.join(options.projectRoot, "package.json")
  );
  const currentProjectSourceMetadata = readSourcePackageMetadata(
    options.projectRoot
  );
  if (
    currentProjectPackageName &&
    currentProjectSourceMetadata
  ) {
    const normalizedProjectRoot = canonicalizeRootDirPath(options.projectRoot);
    authoritativeTsonicPackageRoots.set(
      currentProjectPackageName,
      normalizedProjectRoot
    );
    explicitAuthoritativeRoots.set(
      currentProjectPackageName,
      normalizedProjectRoot
    );
  }
  for (const typeRoot of resolvedRequestedTypeRoots) {
    const packageName = readPackageName(path.join(typeRoot, "package.json"));
    if (packageName && readSourcePackageMetadata(typeRoot)) {
      authoritativeTsonicPackageRoots.set(packageName, typeRoot);
      explicitAuthoritativeRoots.set(packageName, typeRoot);
    }
  }

  for (const [packageName, packageRoot] of scanInstalledSourcePackages(
    options.projectRoot
  )) {
    if (!authoritativeTsonicPackageRoots.has(packageName)) {
      authoritativeTsonicPackageRoots.set(packageName, packageRoot);
    }
  }

  const waveQueue = Array.from(explicitAuthoritativeRoots.entries());
  const visitedWaveRoots = new Set<string>();
  while (waveQueue.length > 0) {
    const [packageName, packageRoot] = waveQueue.shift()!;
    const visitKey = `${packageName}::${path.resolve(packageRoot)}`;
    if (visitedWaveRoots.has(visitKey)) {
      continue;
    }
    visitedWaveRoots.add(visitKey);

    if (!readSourcePackageMetadata(packageRoot)) {
      continue;
    }

    for (const dependencyName of readTsonicDependencyNames(packageRoot)) {
      const dependencyRoot = resolveDependencyPackageRoot(
        packageRoot,
        dependencyName,
        "sibling-first"
      );
      if (!dependencyRoot) {
        continue;
      }

      const existingRoot = authoritativeTsonicPackageRoots.get(dependencyName);
      const existingIsSourcePackage =
        existingRoot !== undefined && readSourcePackageMetadata(existingRoot);
      const dependencyIsSourcePackage =
        readSourcePackageMetadata(dependencyRoot);
      if (
        existingRoot !== undefined &&
        existingRoot !== dependencyRoot &&
        existingIsSourcePackage &&
        !dependencyIsSourcePackage
      ) {
        continue;
      }

      if (existingRoot !== dependencyRoot) {
        authoritativeTsonicPackageRoots.set(dependencyName, dependencyRoot);
        waveQueue.push([dependencyName, dependencyRoot]);
      }
    }
  }

  const nonAuthoritativeTypeRoots = resolvedRequestedTypeRoots.filter(
    (typeRoot) => {
      const packageName = readPackageName(path.join(typeRoot, "package.json"));
      return !(packageName && readSourcePackageMetadata(typeRoot));
    }
  );
  const typeRoots = Array.from(
    new Set<string>([
      ...nonAuthoritativeTypeRoots,
      ...authoritativeTsonicPackageRoots.values(),
    ])
  );

  const sourcePackageAmbientPaths = typeRoots.flatMap((typeRoot) =>
    readSourcePackageAmbientPaths(typeRoot)
  );
  const sourcePackageExportPaths = currentProjectSourceMetadata
    ? readSourcePackageExportPaths(currentProjectSourceMetadata.packageRoot)
    : [];

  if (options.verbose && typeRoots.length > 0) {
    console.log(`TypeRoots: ${typeRoots.join(", ")}`);
  }

  const declarationFiles: string[] = [];
  for (const typeRoot of nonAuthoritativeTypeRoots) {
    declarationFiles.push(...scanForDeclarationFiles(path.resolve(typeRoot)));
  }

  const namespaceIndexFiles: string[] = [];
  for (const typeRoot of nonAuthoritativeTypeRoots) {
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
  if (typeof tsOptions.rootDir === "string" && absolutePaths.length > 0) {
    tsOptions.rootDir = resolveCommonRootDir([
      tsOptions.rootDir,
      ...absolutePaths,
      ...sourcePackageAmbientPaths,
      ...authoritativeTsonicPackageRoots.values(),
    ]);
  }
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
  const hasAuthoritativeJsSurfacePackage =
    authoritativeTsonicPackageRoots.has("@tsonic/js");
  const virtualDeclarationSources = new Map<string, string>([
    ...(!hasAuthoritativeJsSurfacePackage
      ? [[path.resolve(coreGlobalsVirtualPath), CORE_GLOBALS_DECLARATIONS] as const]
      : []),
    ...(isJsSurfaceCompilation && !hasAuthoritativeJsSurfacePackage
      ? [
          [
            path.resolve(jsSurfaceAugmentationsVirtualPath),
            JS_SURFACE_GLOBAL_AUGMENTATIONS,
          ] as const,
        ]
      : []),
  ]);
  const virtualDeclarationFiles = Array.from(virtualDeclarationSources.keys());
  const declarationModuleAliases = new Map(
    collectSourcePackageModuleAliases(typeRoots)
  );
  for (const [specifier, alias] of discoverDeclarationModuleAliases([
    ...projectDeclarationFiles,
    ...declarationFiles,
    ...sourcePackageAmbientPaths,
    ...namespaceIndexFiles,
  ])) {
    if (!declarationModuleAliases.has(specifier)) {
      declarationModuleAliases.set(specifier, alias);
    }
  }

  const allFiles = Array.from(
    new Set([
      ...absolutePaths,
      ...sourcePackageAmbientPaths,
      ...sourcePackageExportPaths,
      ...projectDeclarationFiles,
      ...declarationFiles,
      ...namespaceIndexFiles,
      ...virtualDeclarationFiles,
    ])
  );

  return {
    absolutePaths,
    typeRoots,
    authoritativeTsonicPackageRoots,
    namespaceIndexFiles,
    declarationModuleAliases,
    virtualDeclarationSources,
    allFiles,
    tsOptions,
  };
};
