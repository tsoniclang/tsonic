import * as fs from "node:fs";
import * as path from "node:path";
import type { CompilerOptions } from "./types.js";
import { resolveDependencyPackageRoot } from "./package-roots.js";
import {
  collectProjectIncludedDeclarationFiles,
  scanForDeclarationFiles,
} from "./core-declarations.js";
import {
  discoverDeclarationModuleAliases,
  type DeclarationModuleAlias,
} from "./declaration-module-aliases.js";
import { readPackageName } from "./module-resolution.js";
import { readSourcePackageMetadata } from "./source-package-metadata.js";
import { createDiagnostic, type Diagnostic } from "../types/diagnostic.js";
import {
  CORE_LANG_MODULE_SPECIFIERS,
  CORE_PACKAGE_NAME,
  CORE_TYPES_MODULE_SPECIFIERS,
  coreDeclarationFileBaseName,
} from "../source-frontend/core-module-identity.js";

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

const getSurfacePackageName = (mode: string): string | undefined => {
  const trimmed = mode.trim();
  if (trimmed.length === 0 || trimmed === "core") {
    return undefined;
  }

  return trimmed;
};

const isExplicitAuthoritativePackageRoot = (packageRoot: string): boolean => {
  if (readSourcePackageMetadata(packageRoot)) {
    return true;
  }

  return fs.existsSync(path.join(packageRoot, "tsonic.surface.json"));
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

const isDirectoryLikeEntry = (rootPath: string, entry: fs.Dirent): boolean => {
  if (entry.isDirectory()) {
    return true;
  }
  if (!entry.isSymbolicLink()) {
    return false;
  }

  try {
    return fs.statSync(path.join(rootPath, entry.name)).isDirectory();
  } catch {
    return false;
  }
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
  const workspaceBoundary = (() => {
    let candidate = normalizedRoot;
    for (;;) {
      if (fs.existsSync(path.join(candidate, "tsonic.workspace.json"))) {
        return canonicalizeRootDirPath(candidate);
      }
      const parentDir = path.dirname(candidate);
      if (parentDir === candidate) {
        return undefined;
      }
      candidate = parentDir;
    }
  })();

  for (;;) {
    const nodeModulesRoot = path.join(currentDir, "node_modules");
    if (fs.existsSync(nodeModulesRoot)) {
      const entries = fs.readdirSync(nodeModulesRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!isDirectoryLikeEntry(nodeModulesRoot, entry)) {
          continue;
        }

        if (entry.name.startsWith("@")) {
          const scopeRoot = path.join(nodeModulesRoot, entry.name);
          const scopedEntries = fs.readdirSync(scopeRoot, {
            withFileTypes: true,
          });
          for (const scopedEntry of scopedEntries) {
            if (!isDirectoryLikeEntry(scopeRoot, scopedEntry)) {
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

    if (
      workspaceBoundary !== undefined &&
      canonicalizeRootDirPath(currentDir) === workspaceBoundary
    ) {
      break;
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
  readonly moduleResolutionPaths: Readonly<Record<string, readonly string[]>>;
  readonly sourceDiagnosticRoots: readonly string[];
  readonly authoritativeTsonicPackageRoots: ReadonlyMap<string, string>;
  readonly namespaceIndexFiles: readonly string[];
  readonly declarationModuleAliases: ReadonlyMap<
    string,
    DeclarationModuleAlias
  >;
  readonly ambientSupportFiles: readonly string[];
  readonly diagnostics: readonly Diagnostic[];
  readonly allFiles: readonly string[];
  readonly runtimeSeedFiles: readonly string[];
};

const isPathMappingEligibleModuleSpecifier = (specifier: string): boolean =>
  specifier.length > 0 &&
  !specifier.startsWith(".") &&
  !path.isAbsolute(specifier);

const exportSpecifierForSourcePackageEntry = (
  packageName: string,
  exportKey: string
): string =>
  exportKey === "."
    ? packageName
    : `${packageName}/${exportKey.replace(/^\.\//, "")}`;

const addModuleResolutionPath = (
  paths: Map<string, string>,
  diagnostics: Diagnostic[],
  specifier: string,
  resolvedTarget: string
): void => {
  if (!isPathMappingEligibleModuleSpecifier(specifier)) {
    return;
  }

  const absoluteTarget = path.resolve(resolvedTarget);
  const existingTarget = paths.get(specifier);
  if (existingTarget === undefined) {
    paths.set(specifier, absoluteTarget);
    return;
  }

  if (
    canonicalizeRootDirPath(existingTarget) !==
    canonicalizeRootDirPath(absoluteTarget)
  ) {
    diagnostics.push(
      createDiagnostic(
        "TSN1002",
        "fatal",
        `Module specifier '${specifier}' resolves to multiple source files and cannot be represented as a deterministic TSTS path mapping.`,
        undefined,
        `${existingTarget}\n${absoluteTarget}`
      )
    );
  }
};

const corePackageRootExists = (packageRoot: string): boolean =>
  fs.existsSync(path.join(packageRoot, "package.json"));

const activeCorePackageRoot = (
  projectRoot: string,
  authoritativeTsonicPackageRoots: ReadonlyMap<string, string>
): string | undefined => {
  const authoritativeRoot = authoritativeTsonicPackageRoots.get(
    CORE_PACKAGE_NAME
  );
  if (authoritativeRoot !== undefined) return authoritativeRoot;

  const projectCoreRoot = path.join(
    projectRoot,
    "node_modules",
    "@tsonic",
    "core"
  );
  return corePackageRootExists(projectCoreRoot) ? projectCoreRoot : undefined;
};

const addMissingCoreDeclarationDiagnostic = (
  diagnostics: Diagnostic[],
  coreRoot: string
): boolean => {
  const requiredFiles = [
    path.join(coreRoot, coreDeclarationFileBaseName("types")),
    path.join(coreRoot, coreDeclarationFileBaseName("lang")),
  ];
  const missingFiles = requiredFiles.filter((filePath) => !fs.existsSync(filePath));
  if (missingFiles.length === 0) return false;
  diagnostics.push(
    createDiagnostic(
      "TSN1004",
      "fatal",
      "Active @tsonic/core package is missing required source declaration files.",
      undefined,
      `Missing files:\n${missingFiles.join("\n")}`
    )
  );
  return true;
};

const addCoreModuleResolutionPaths = (
  paths: Map<string, string>,
  diagnostics: Diagnostic[],
  projectRoot: string,
  authoritativeTsonicPackageRoots: ReadonlyMap<string, string>
): void => {
  const coreRoot = activeCorePackageRoot(
    projectRoot,
    authoritativeTsonicPackageRoots
  );
  if (!coreRoot) {
    return;
  }
  if (addMissingCoreDeclarationDiagnostic(diagnostics, coreRoot)) {
    return;
  }

  for (const specifier of CORE_TYPES_MODULE_SPECIFIERS) {
    addModuleResolutionPath(
      paths,
      diagnostics,
      specifier,
      path.join(coreRoot, coreDeclarationFileBaseName("types"))
    );
  }
  for (const specifier of CORE_LANG_MODULE_SPECIFIERS) {
    addModuleResolutionPath(
      paths,
      diagnostics,
      specifier,
      path.join(coreRoot, coreDeclarationFileBaseName("lang"))
    );
  }
};

const addSourcePackageModuleResolutionPaths = (
  paths: Map<string, string>,
  diagnostics: Diagnostic[],
  packageRoot: string
): void => {
  const metadata = readSourcePackageMetadata(packageRoot);
  if (!metadata) {
    return;
  }

  const packageExportPaths = new Map<string, string>();
  for (const [exportKey, target] of Object.entries(metadata.exports)) {
    const specifier = exportSpecifierForSourcePackageEntry(
      metadata.packageName,
      exportKey
    );
    const resolvedTarget = path.resolve(metadata.packageRoot, target);
    if (!fs.existsSync(resolvedTarget)) {
      continue;
    }
    packageExportPaths.set(specifier, resolvedTarget);
    addModuleResolutionPath(paths, diagnostics, specifier, resolvedTarget);
  }

  for (const [specifier, targetSpecifier] of Object.entries(
    metadata.moduleAliases
  )) {
    const targetPath = packageExportPaths.get(targetSpecifier);
    if (targetPath) {
      addModuleResolutionPath(paths, diagnostics, specifier, targetPath);
    }
  }
};

const addDeclarationModuleAliasPaths = (
  paths: Map<string, string>,
  diagnostics: Diagnostic[],
  declarationModuleAliases: ReadonlyMap<string, DeclarationModuleAlias>
): void => {
  for (const [specifier, alias] of declarationModuleAliases) {
    const targetPath = paths.get(alias.targetSpecifier);
    if (targetPath) {
      addModuleResolutionPath(paths, diagnostics, specifier, targetPath);
    }
  }
};

const createModuleResolutionPaths = (input: {
  readonly projectRoot: string;
  readonly authoritativeTsonicPackageRoots: ReadonlyMap<string, string>;
  readonly declarationModuleAliases: ReadonlyMap<string, DeclarationModuleAlias>;
}): {
  readonly paths: Readonly<Record<string, readonly string[]>>;
  readonly diagnostics: readonly Diagnostic[];
} => {
  const paths = new Map<string, string>();
  const diagnostics: Diagnostic[] = [];

  addCoreModuleResolutionPaths(
    paths,
    diagnostics,
    input.projectRoot,
    input.authoritativeTsonicPackageRoots
  );
  for (const packageRoot of input.authoritativeTsonicPackageRoots.values()) {
    addSourcePackageModuleResolutionPaths(paths, diagnostics, packageRoot);
  }
  addDeclarationModuleAliasPaths(
    paths,
    diagnostics,
    input.declarationModuleAliases
  );

  return {
    paths: Object.fromEntries(
      Array.from(paths.entries()).map(([specifier, resolvedTarget]) => [
        specifier,
        [resolvedTarget],
      ])
    ),
    diagnostics,
  };
};

const sourceDiagnosticRootsForProgram = (
  sourceRoot: string
): readonly string[] => [canonicalizeRootDirPath(sourceRoot)];

const dedupePaths = (paths: readonly string[]): readonly string[] =>
  Array.from(new Set(paths.map((entry) => canonicalizeRootDirPath(entry))));

const createProgramFileSet = (
  runtimeSeedFiles: readonly string[],
  ambientSupportFiles: readonly string[]
): readonly string[] =>
  dedupePaths([...runtimeSeedFiles, ...ambientSupportFiles]);

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
  const activeAuthoritativeSourcePackageRoots = new Map<string, string>();
  const activeSurfacePackageNames = new Set(
    surfaceCapabilities.resolvedModes
      .map((mode) => getSurfacePackageName(mode))
      .filter((mode): mode is string => mode !== undefined)
  );
  const currentProjectPackageName = readPackageName(
    path.join(options.projectRoot, "package.json")
  );
  const currentProjectSourceMetadata = readSourcePackageMetadata(
    options.projectRoot
  );
  const includeCurrentPackageExports =
    options.programInputScope !== "entrypoint";
  if (currentProjectPackageName && currentProjectSourceMetadata) {
    const normalizedProjectRoot = canonicalizeRootDirPath(options.projectRoot);
    authoritativeTsonicPackageRoots.set(
      currentProjectPackageName,
      normalizedProjectRoot
    );
    activeAuthoritativeSourcePackageRoots.set(
      currentProjectPackageName,
      normalizedProjectRoot
    );
  }
  for (const typeRoot of resolvedRequestedTypeRoots) {
    const packageName = readPackageName(path.join(typeRoot, "package.json"));
    if (packageName && isExplicitAuthoritativePackageRoot(typeRoot)) {
      if (!authoritativeTsonicPackageRoots.has(packageName)) {
        authoritativeTsonicPackageRoots.set(packageName, typeRoot);
      }
      if (readSourcePackageMetadata(typeRoot)) {
        if (!activeAuthoritativeSourcePackageRoots.has(packageName)) {
          activeAuthoritativeSourcePackageRoots.set(packageName, typeRoot);
        }
      }
    }
  }

  for (const [packageName, packageRoot] of scanInstalledSourcePackages(
    options.projectRoot
  )) {
    if (!authoritativeTsonicPackageRoots.has(packageName)) {
      authoritativeTsonicPackageRoots.set(packageName, packageRoot);
    }
    if (
      activeSurfacePackageNames.has(packageName) &&
      !activeAuthoritativeSourcePackageRoots.has(packageName)
    ) {
      activeAuthoritativeSourcePackageRoots.set(packageName, packageRoot);
    }
  }

  const waveQueue = Array.from(activeAuthoritativeSourcePackageRoots.entries());
  const visitedWaveRoots = new Set<string>();
  while (waveQueue.length > 0) {
    const nextWaveEntry = waveQueue.shift();
    if (!nextWaveEntry) {
      continue;
    }
    const [packageName, packageRoot] = nextWaveEntry;
    const visitKey = `${packageName}::${path.resolve(packageRoot)}`;
    if (visitedWaveRoots.has(visitKey)) {
      continue;
    }
    visitedWaveRoots.add(visitKey);

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
      }

      if (
        dependencyIsSourcePackage &&
        activeAuthoritativeSourcePackageRoots.get(dependencyName) !==
          dependencyRoot
      ) {
        activeAuthoritativeSourcePackageRoots.set(
          dependencyName,
          dependencyRoot
        );
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
  const orderedSurfaceTypeRoots: string[] = [];
  const seenSurfaceTypeRoots = new Set<string>();
  const pushSurfaceTypeRoot = (root: string | undefined): void => {
    if (!root || seenSurfaceTypeRoots.has(root)) {
      return;
    }
    seenSurfaceTypeRoots.add(root);
    orderedSurfaceTypeRoots.push(root);
  };

  for (const mode of [...surfaceCapabilities.resolvedModes].reverse()) {
    const packageName = getSurfacePackageName(mode);
    if (!packageName) {
      continue;
    }
    pushSurfaceTypeRoot(
      authoritativeTsonicPackageRoots.get(packageName) ??
        activeAuthoritativeSourcePackageRoots.get(packageName)
    );
  }

  for (const root of activeAuthoritativeSourcePackageRoots.values()) {
    pushSurfaceTypeRoot(root);
  }

  for (const root of nonAuthoritativeTypeRoots) {
    pushSurfaceTypeRoot(root);
  }

  const typeRoots = [...orderedSurfaceTypeRoots];

  const sourcePackageAmbientPaths = typeRoots.flatMap((typeRoot) =>
    readSourcePackageAmbientPaths(typeRoot)
  );
  const currentSourcePackageExportPaths =
    currentProjectSourceMetadata && includeCurrentPackageExports
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
        if (entry.isDirectory()) {
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

  const projectDeclarationFiles = collectProjectIncludedDeclarationFiles(
    options.projectRoot
  );

  const declarationModuleAliases = new Map(
    collectSourcePackageModuleAliases([
      ...typeRoots,
      ...authoritativeTsonicPackageRoots.values(),
    ])
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

  const ambientSupportFiles = Array.from(
    new Set([
      ...sourcePackageAmbientPaths,
      ...projectDeclarationFiles,
      ...declarationFiles,
      ...namespaceIndexFiles,
    ])
  );
  const runtimeSeedFiles = dedupePaths([
    ...absolutePaths,
    ...currentSourcePackageExportPaths,
  ]);
  const allFiles = createProgramFileSet(runtimeSeedFiles, ambientSupportFiles);
  const sourceDiagnosticRoots = sourceDiagnosticRootsForProgram(
    options.sourceRoot
  );
  const moduleResolution = createModuleResolutionPaths({
    projectRoot: options.projectRoot,
    authoritativeTsonicPackageRoots,
    declarationModuleAliases,
  });

  return {
    absolutePaths,
    typeRoots,
    moduleResolutionPaths: moduleResolution.paths,
    sourceDiagnosticRoots,
    authoritativeTsonicPackageRoots,
    namespaceIndexFiles,
    declarationModuleAliases,
    ambientSupportFiles,
    diagnostics: moduleResolution.diagnostics,
    allFiles,
    runtimeSeedFiles,
  };
};
