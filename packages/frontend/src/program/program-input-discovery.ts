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

const resolveCommonRootDir = (paths: readonly string[]): string => {
  const [first, ...remaining] = paths;
  if (!first) {
    throw new Error("resolveCommonRootDir requires at least one path");
  }
  const rest = remaining.map((filePath) => path.resolve(filePath));
  let current = path.resolve(first);

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
  const typeRoots = resolvedRequestedTypeRoots;

  const authoritativeTsonicPackageRoots = new Map<string, string>();
  for (const typeRoot of typeRoots) {
    const packageName = readPackageName(path.join(typeRoot, "package.json"));
    if (packageName?.startsWith("@tsonic/")) {
      authoritativeTsonicPackageRoots.set(packageName, typeRoot);
    }
  }

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
