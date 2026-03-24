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
import { readPackageName } from "./module-resolution.js";

type SurfaceCapabilitiesLike = {
  readonly requiredTypeRoots: readonly string[];
  readonly resolvedModes: readonly string[];
};

type SourcePackageManifest = {
  readonly kind?: unknown;
  readonly source?: {
    readonly exports?: Record<string, unknown>;
  };
};

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

const readSourcePackageManifest = (
  packageRoot: string
): SourcePackageManifest | undefined => {
  const manifestPath = path.join(
    packageRoot,
    "tsonic",
    "package-manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as
      | SourcePackageManifest
      | undefined;
    if (parsed?.kind !== "tsonic-source-package") {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
};

const readSourcePackageEntryPath = (packageRoot: string): string | undefined => {
  const manifest = readSourcePackageManifest(packageRoot);
  const exportTarget = manifest?.source?.exports?.["."];
  if (typeof exportTarget !== "string" || exportTarget.length === 0) {
    return undefined;
  }

  return path.resolve(packageRoot, exportTarget);
};

const readTsonicDependencyNames = (
  packageRoot: string
): readonly string[] => {
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
        ].filter((packageName) => packageName.startsWith("@tsonic/"))
      )
    );
  } catch {
    return [];
  }
};

export type ProgramInputDiscovery = {
  readonly absolutePaths: readonly string[];
  readonly typeRoots: readonly string[];
  readonly authoritativeTsonicPackageRoots: ReadonlyMap<string, string>;
  readonly namespaceIndexFiles: readonly string[];
  readonly virtualDeclarationSources: ReadonlyMap<string, string>;
  readonly allFiles: readonly string[];
  readonly tsOptions: ts.CompilerOptions;
};

export const discoverProgramInputs = (
  filePaths: readonly string[],
  options: CompilerOptions,
  surfaceCapabilities: SurfaceCapabilitiesLike,
  resolveCompilerOwnedTsonicPackageRoot: (pkgDirName: string) => string | null
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
  const authoritativeTsonicPackageRoots = new Map<string, string>();
  for (const typeRoot of resolvedRequestedTypeRoots) {
    const packageName = readPackageName(path.join(typeRoot, "package.json"));
    if (packageName?.startsWith("@tsonic/")) {
      authoritativeTsonicPackageRoots.set(packageName, typeRoot);
    }
  }

  const waveQueue = Array.from(authoritativeTsonicPackageRoots.entries());
  const visitedWaveRoots = new Set<string>();
  while (waveQueue.length > 0) {
    const [packageName, packageRoot] = waveQueue.shift()!;
    const visitKey = `${packageName}::${path.resolve(packageRoot)}`;
    if (visitedWaveRoots.has(visitKey)) {
      continue;
    }
    visitedWaveRoots.add(visitKey);

    if (!readSourcePackageManifest(packageRoot)) {
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
        existingRoot !== undefined && readSourcePackageManifest(existingRoot);
      const dependencyIsSourcePackage = readSourcePackageManifest(dependencyRoot);
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
      return !packageName?.startsWith("@tsonic/");
    }
  );
  const typeRoots = Array.from(
    new Set<string>([
      ...nonAuthoritativeTypeRoots,
      ...authoritativeTsonicPackageRoots.values(),
    ])
  );

  const sourcePackageEntryPaths = typeRoots
    .map((typeRoot) => readSourcePackageEntryPath(typeRoot))
    .filter((entryPath): entryPath is string => entryPath !== undefined);

  if (options.verbose && typeRoots.length > 0) {
    console.log(`TypeRoots: ${typeRoots.join(", ")}`);
  }

  const declarationFiles: string[] = [];
  for (const typeRoot of typeRoots) {
    declarationFiles.push(...scanForDeclarationFiles(path.resolve(typeRoot)));
  }

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
  if (typeof tsOptions.rootDir === "string" && absolutePaths.length > 0) {
    tsOptions.rootDir = resolveCommonRootDir([
      tsOptions.rootDir,
      ...absolutePaths,
      ...sourcePackageEntryPaths,
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

  const allFiles = Array.from(
    new Set([
      ...absolutePaths,
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
    virtualDeclarationSources,
    allFiles,
    tsOptions,
  };
};
