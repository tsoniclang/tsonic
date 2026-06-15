import * as fs from "node:fs";
import * as path from "node:path";
import type { CompilerOptions } from "./types.js";
import { resolveDependencyPackageRoot } from "./package-roots.js";
import {
  collectProjectIncludedDeclarationFiles,
  scanForDeclarationFiles,
} from "./core-declarations.js";
import {
  discoverDeclarationGlobalImports,
  discoverDeclarationModuleAliases,
  type DeclarationModuleAlias,
} from "./declaration-module-aliases.js";
import { readPackageName } from "./module-resolution.js";
import { readSourcePackageMetadata } from "./source-package-metadata.js";
import { resolveImport } from "../resolver/import-resolution.js";
import { parsePackageSpecifier } from "../resolver/source-package-resolution.js";
import { createDiagnostic, type Diagnostic } from "../types/diagnostic.js";
import type { WorkspaceGraphEdge } from "./workspace-fingerprint.js";
import {
  createExtensionModuleGraph,
  parseTstsSourceFile,
} from "@tsonic/tsts";

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
  readonly authoritativeTsonicPackageRoots: ReadonlyMap<string, string>;
  readonly namespaceIndexFiles: readonly string[];
  readonly declarationModuleAliases: ReadonlyMap<
    string,
    DeclarationModuleAlias
  >;
  readonly ambientSupportFiles: readonly string[];
  readonly dependencyEdges: readonly WorkspaceGraphEdge[];
  readonly diagnostics: readonly Diagnostic[];
  readonly allFiles: readonly string[];
  readonly emittableSourceFiles: readonly string[];
};

const isQueueableTsSourceDependency = (resolvedPath: string): boolean =>
  (resolvedPath.endsWith(".ts") ||
    resolvedPath.endsWith(".mts") ||
    resolvedPath.endsWith(".cts")) &&
  !resolvedPath.endsWith(".d.ts") &&
  !resolvedPath.endsWith(".d.mts") &&
  !resolvedPath.endsWith(".d.cts");

const isDeclarationDependency = (resolvedPath: string): boolean =>
  resolvedPath.endsWith(".d.ts") ||
  resolvedPath.endsWith(".d.mts") ||
  resolvedPath.endsWith(".d.cts");

const appendUniquePath = (
  files: string[],
  seenCanonicalPaths: Set<string>,
  filePath: string
): boolean => {
  const canonicalPath = canonicalizeRootDirPath(filePath);
  if (seenCanonicalPaths.has(canonicalPath)) {
    return false;
  }
  seenCanonicalPaths.add(canonicalPath);
  files.push(path.resolve(filePath));
  return true;
};

const getModuleSpecifiers = (
  sourceFile: ReturnType<typeof parseTstsSourceFile>
): readonly string[] => {
  const moduleGraph = createExtensionModuleGraph(undefined, [sourceFile]);
  const module = moduleGraph.getSourceFileModule(sourceFile);
  if (!module) {
    return [];
  }
  return [
    ...module.imports
      .filter(
        (importModule) =>
          !(importModule.isTypeOnly && importModule.bindings.length === 0)
      )
      .map((importModule) => importModule.specifier),
    ...module.exports
      .map((binding) => binding.sourceSpecifier)
      .filter((specifier): specifier is string => specifier !== undefined),
  ];
};

const findAuthoritativePackageRootForImport = (
  importSpecifier: string,
  authoritativeTsonicPackageRoots: ReadonlyMap<string, string>
): string | undefined => {
  const parsed = parsePackageSpecifier(importSpecifier);
  if (!parsed) {
    return undefined;
  }
  return authoritativeTsonicPackageRoots.get(parsed.packageName);
};

const shouldReportImportDiscoveryDiagnostic = (
  importSpecifier: string,
  authoritativeTsonicPackageRoots: ReadonlyMap<string, string>,
  declarationModuleAliases: ReadonlyMap<string, DeclarationModuleAlias>
): boolean => {
  if (importSpecifier.startsWith(".") || importSpecifier.startsWith("/")) {
    return true;
  }
  if (declarationModuleAliases.has(importSpecifier)) {
    return true;
  }
  return (
    findAuthoritativePackageRootForImport(
      importSpecifier,
      authoritativeTsonicPackageRoots
    ) !== undefined
  );
};

export const collectSourceImportClosure = (input: {
  readonly seedFiles: readonly string[];
  readonly sourceRoot: string;
  readonly projectRoot: string;
  readonly surface: CompilerOptions["surface"];
  readonly backendTargetId?: string;
  readonly authoritativeTsonicPackageRoots: ReadonlyMap<string, string>;
  readonly declarationModuleAliases: ReadonlyMap<string, DeclarationModuleAlias>;
}): {
  readonly files: readonly string[];
  readonly dependencyEdges: readonly WorkspaceGraphEdge[];
  readonly diagnostics: readonly Diagnostic[];
} => {
  const files: string[] = [];
  const queue: string[] = [];
  const visited = new Set<string>();
  const seenFiles = new Set<string>();
  const dependencyEdges: WorkspaceGraphEdge[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const filePath of input.seedFiles) {
    appendUniquePath(queue, visited, filePath);
  }
  visited.clear();

  while (queue.length > 0) {
    const currentFile = queue.shift();
    if (!currentFile) {
      continue;
    }

    const resolvedCurrentFile = path.resolve(currentFile);
    const canonicalCurrentFile = canonicalizeRootDirPath(resolvedCurrentFile);
    if (visited.has(canonicalCurrentFile)) {
      continue;
    }
    visited.add(canonicalCurrentFile);
    appendUniquePath(files, seenFiles, resolvedCurrentFile);

    let sourceText: string;
    try {
      sourceText = fs.readFileSync(resolvedCurrentFile, "utf-8");
    } catch {
      diagnostics.push(
        createDiagnostic("TSN1002", "error", `Cannot find module '${currentFile}'`, {
          file: currentFile,
          line: 1,
          column: 1,
          length: 1,
        })
      );
      continue;
    }

    const sourceFile = parseTstsSourceFile(sourceText, {
      fileName: resolvedCurrentFile,
    });
    for (const importSpecifier of getModuleSpecifiers(sourceFile)) {
      const resolved = resolveImport(
        importSpecifier,
        resolvedCurrentFile,
        input.sourceRoot,
        {
          projectRoot: input.projectRoot,
          surface: input.surface,
          backendTargetId: input.backendTargetId,
          authoritativeTsonicPackageRoots: input.authoritativeTsonicPackageRoots,
          declarationModuleAliases: input.declarationModuleAliases,
        }
      );
      if (!resolved.ok) {
        if (
          shouldReportImportDiscoveryDiagnostic(
            importSpecifier,
            input.authoritativeTsonicPackageRoots,
            input.declarationModuleAliases
          )
        ) {
          diagnostics.push({
            ...resolved.error,
            location: {
              file: canonicalCurrentFile,
              line: 1,
              column: 1,
              length: importSpecifier.length,
            },
          });
        }
        continue;
      }

      const resolvedPath = resolved.value.resolvedPath;
      if (!resolvedPath) {
        continue;
      }

      const resolvedDependencyPath = path.resolve(resolvedPath);
      dependencyEdges.push({
        from: resolvedCurrentFile,
        to: resolvedDependencyPath,
        specifier: importSpecifier,
      });

      if (isDeclarationDependency(resolvedDependencyPath)) {
        appendUniquePath(files, seenFiles, resolvedDependencyPath);
        continue;
      }

      if (!isQueueableTsSourceDependency(resolvedDependencyPath)) {
        continue;
      }

      queue.push(resolvedDependencyPath);
    }
  }

  return {
    files,
    dependencyEdges,
    diagnostics,
  };
};

export const collectDeclarationImportClosure = (input: {
  readonly files: readonly string[];
  readonly sourceRoot: string;
  readonly projectRoot: string;
  readonly surface?: string;
  readonly backendTargetId?: string;
  readonly authoritativeTsonicPackageRoots: ReadonlyMap<string, string>;
  readonly declarationModuleAliases: ReadonlyMap<string, DeclarationModuleAlias>;
}): {
  readonly files: readonly string[];
  readonly dependencyEdges: readonly WorkspaceGraphEdge[];
  readonly diagnostics: readonly Diagnostic[];
} => {
  const files: string[] = [];
  const queue: string[] = [];
  const seenFiles = new Set<string>();
  const visited = new Set<string>();
  const dependencyEdges: WorkspaceGraphEdge[] = [];
  const diagnostics: Diagnostic[] = [];
  const seenEdges = new Set<string>();

  for (const filePath of input.files) {
    if (!isDeclarationDependency(path.resolve(filePath))) {
      continue;
    }
    if (appendUniquePath(files, seenFiles, filePath)) {
      queue.push(path.resolve(filePath));
    }
  }

  while (queue.length > 0) {
    const nextFile = queue.shift();
    if (!nextFile) {
      continue;
    }

    const resolvedFile = path.resolve(nextFile);
    const canonicalFile = canonicalizeRootDirPath(resolvedFile);
    if (visited.has(canonicalFile)) {
      continue;
    }
    visited.add(canonicalFile);

    let sourceText: string;
    try {
      sourceText = fs.readFileSync(resolvedFile, "utf-8");
    } catch {
      diagnostics.push(
        createDiagnostic("TSN1002", "error", `Cannot find module '${nextFile}'`, {
          file: nextFile,
          line: 1,
          column: 1,
          length: 1,
        })
      );
      continue;
    }

    const sourceFile = parseTstsSourceFile(sourceText, {
      fileName: resolvedFile,
    });
    for (const importSpecifier of getModuleSpecifiers(sourceFile)) {
      const resolved = resolveImport(
        importSpecifier,
        resolvedFile,
        input.sourceRoot,
        {
          projectRoot: input.projectRoot,
          surface: input.surface,
          backendTargetId: input.backendTargetId,
          authoritativeTsonicPackageRoots: input.authoritativeTsonicPackageRoots,
          declarationModuleAliases: input.declarationModuleAliases,
        }
      );
      if (!resolved.ok) {
        if (
          shouldReportImportDiscoveryDiagnostic(
            importSpecifier,
            input.authoritativeTsonicPackageRoots,
            input.declarationModuleAliases
          )
        ) {
          diagnostics.push({
            ...resolved.error,
            location: {
              file: resolvedFile,
              line: 1,
              column: 1,
              length: importSpecifier.length,
            },
          });
        }
        continue;
      }

      const resolvedPath = resolved.value.resolvedPath;
      if (!resolvedPath) {
        continue;
      }

      const resolvedDependencyPath = path.resolve(resolvedPath);
      const edge = {
        from: resolvedFile,
        to: resolvedDependencyPath,
        specifier: importSpecifier,
      };
      const edgeId = `${edge.from}\0${edge.specifier}\0${edge.to}`;
      if (!seenEdges.has(edgeId)) {
        seenEdges.add(edgeId);
        dependencyEdges.push(edge);
      }

      if (
        isDeclarationDependency(resolvedDependencyPath) &&
        appendUniquePath(files, seenFiles, resolvedDependencyPath)
      ) {
        queue.push(resolvedDependencyPath);
      }
    }
  }

  return { files, dependencyEdges, diagnostics };
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
  const ambientGlobalSourceFiles: string[] = [];
  const discoveryDiagnostics: Diagnostic[] = [];
  for (const declarationGlobalImport of discoverDeclarationGlobalImports(
    ambientSupportFiles
  )) {
    const resolvedGlobalImport = resolveImport(
      declarationGlobalImport.targetSpecifier,
      declarationGlobalImport.declarationFile,
      path.resolve(options.sourceRoot),
      {
        projectRoot: options.projectRoot,
        surface: options.surface,
        backendTargetId:
          options.backendTargetId === undefined
            ? undefined
            : String(options.backendTargetId),
        authoritativeTsonicPackageRoots,
        declarationModuleAliases,
      }
    );
    if (!resolvedGlobalImport.ok) {
      discoveryDiagnostics.push(resolvedGlobalImport.error);
      continue;
    }
    if (
      resolvedGlobalImport.value.resolvedPath &&
      isQueueableTsSourceDependency(resolvedGlobalImport.value.resolvedPath)
    ) {
      ambientGlobalSourceFiles.push(resolvedGlobalImport.value.resolvedPath);
    }
  }

  const runtimeSourceClosure = collectSourceImportClosure({
    seedFiles: [
      ...absolutePaths,
      ...currentSourcePackageExportPaths,
    ],
    sourceRoot: path.resolve(options.sourceRoot),
    projectRoot: options.projectRoot,
    surface: options.surface,
    backendTargetId:
      options.backendTargetId === undefined
        ? undefined
        : String(options.backendTargetId),
    authoritativeTsonicPackageRoots,
    declarationModuleAliases,
  });
  const semanticSupportClosure = collectSourceImportClosure({
    seedFiles: [
      ...sourcePackageAmbientPaths,
      ...ambientGlobalSourceFiles,
    ],
    sourceRoot: path.resolve(options.sourceRoot),
    projectRoot: options.projectRoot,
    surface: options.surface,
    backendTargetId:
      options.backendTargetId === undefined
        ? undefined
        : String(options.backendTargetId),
    authoritativeTsonicPackageRoots,
    declarationModuleAliases,
  });

  const initialAllFiles = Array.from(
    new Set([
      ...runtimeSourceClosure.files,
      ...semanticSupportClosure.files,
      ...projectDeclarationFiles,
      ...declarationFiles,
      ...namespaceIndexFiles,
    ])
  );
  const declarationClosure = collectDeclarationImportClosure({
    files: initialAllFiles,
    sourceRoot: path.resolve(options.sourceRoot),
    projectRoot: options.projectRoot,
    surface: options.surface,
    backendTargetId:
      options.backendTargetId === undefined
        ? undefined
        : String(options.backendTargetId),
    authoritativeTsonicPackageRoots,
    declarationModuleAliases,
  });

  const allFiles = Array.from(
    new Set([...initialAllFiles, ...declarationClosure.files])
  );
  const emittableSourceFiles = Array.from(
    new Set([
      ...runtimeSourceClosure.files,
    ])
  );

  return {
    absolutePaths,
    typeRoots,
    authoritativeTsonicPackageRoots,
    namespaceIndexFiles,
    declarationModuleAliases,
    ambientSupportFiles,
    dependencyEdges: [
      ...runtimeSourceClosure.dependencyEdges,
      ...semanticSupportClosure.dependencyEdges,
      ...declarationClosure.dependencyEdges,
    ],
    diagnostics: [
      ...discoveryDiagnostics,
      ...runtimeSourceClosure.diagnostics,
      ...semanticSupportClosure.diagnostics,
      ...declarationClosure.diagnostics,
    ],
    allFiles,
    emittableSourceFiles,
  };
};
