import * as fs from "node:fs";
import * as path from "node:path";
import type { SurfaceMode } from "../program/types.js";
import { resolveDependencyPackageRoot } from "../program/package-roots.js";
import { createDiagnostic, type Diagnostic } from "../types/diagnostic.js";
import { resolveSurfaceCapabilities } from "../surface/profiles.js";
import { error, ok, type Result } from "../types/result.js";

type SourcePackageManifest = {
  readonly schemaVersion?: unknown;
  readonly kind?: unknown;
  readonly surfaces?: unknown;
  readonly source?: unknown;
};

type ParsedSourceSection = {
  readonly exports: Readonly<Record<string, string>>;
};

export type ResolvedSourcePackageImport = {
  readonly packageName: string;
  readonly packageRoot: string;
  readonly resolvedPath: string;
};

const installedPackageRootCache = new Map<string, string | null>();
const containingSourcePackageRootCache = new Map<string, string>();

const splitPackageNameSegments = (packageName: string): readonly string[] =>
  packageName.startsWith("@") ? packageName.split("/") : [packageName];

const findInstalledPackageRoot = (
  packageName: string,
  containingFile: string
): string | undefined => {
  const cacheKey = `${path.resolve(containingFile)}::${packageName}`;
  const cached = installedPackageRootCache.get(cacheKey);
  if (cached !== undefined) {
    return cached ?? undefined;
  }
  const packageSegments = splitPackageNameSegments(packageName);
  let currentDir = path.dirname(path.resolve(containingFile));

  for (;;) {
    const candidate = path.join(currentDir, "node_modules", ...packageSegments);
    if (fs.existsSync(path.join(candidate, "package.json"))) {
      installedPackageRootCache.set(cacheKey, candidate);
      return candidate;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  const containingSourcePackageRoot =
    findContainingSourcePackageRoot(containingFile);
  if (containingSourcePackageRoot) {
    const siblingDependencyRoot = resolveDependencyPackageRoot(
      containingSourcePackageRoot,
      packageName,
      "sibling-first"
    );
    if (siblingDependencyRoot) {
      installedPackageRootCache.set(cacheKey, siblingDependencyRoot);
      return siblingDependencyRoot;
    }
  }

  installedPackageRootCache.set(cacheKey, null);
  return undefined;
};

const findContainingSourcePackageRoot = (
  filePath: string
): string | undefined => {
  const normalizedFilePath = path.resolve(filePath);
  const cached = containingSourcePackageRootCache.get(normalizedFilePath);
  if (cached !== undefined) {
    return cached;
  }
  let currentDir = path.dirname(filePath);
  for (;;) {
    const manifestPath = path.join(
      currentDir,
      "tsonic.package.json"
    );
    const packageJsonPath = path.join(currentDir, "package.json");
    if (fs.existsSync(manifestPath) && fs.existsSync(packageJsonPath)) {
      const manifestResult = readManifest(manifestPath);
      if (
        manifestResult.ok &&
        manifestResult.value?.kind === "tsonic-source-package"
      ) {
        containingSourcePackageRootCache.set(normalizedFilePath, currentDir);
        return currentDir;
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) return undefined;
    currentDir = parentDir;
  }
};

export const isPathWithinBoundary = (
  filePath: string,
  boundary: string
): boolean => {
  const relative = path.relative(
    path.resolve(boundary),
    path.resolve(filePath)
  );
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
};

export const getLocalResolutionBoundary = (
  containingFile: string,
  defaultSourceRoot: string
): string => {
  if (isPathWithinBoundary(containingFile, defaultSourceRoot)) {
    return defaultSourceRoot;
  }
  return findContainingSourcePackageRoot(containingFile) ?? defaultSourceRoot;
};

const parsePackageSpecifier = (
  importSpecifier: string
):
  | {
      readonly packageName: string;
      readonly subpath: string | undefined;
    }
  | undefined => {
  if (importSpecifier.startsWith(".") || importSpecifier.startsWith("/")) {
    return undefined;
  }

  if (importSpecifier.startsWith("@")) {
    const match = importSpecifier.match(/^(@[^/]+\/[^/]+)(?:\/(.+))?$/);
    if (!match?.[1]) return undefined;
    return {
      packageName: match[1],
      subpath: match[2],
    };
  }

  const match = importSpecifier.match(/^([^/]+)(?:\/(.+))?$/);
  if (!match?.[1]) return undefined;
  return {
    packageName: match[1],
    subpath: match[2],
  };
};

const readManifest = (
  manifestPath: string
): Result<SourcePackageManifest | null, Diagnostic> => {
  if (!fs.existsSync(manifestPath)) return ok(null);
  try {
    const parsed = JSON.parse(
      fs.readFileSync(manifestPath, "utf-8")
    ) as unknown;
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return error(
        createDiagnostic(
          "TSN1004",
          "error",
          `Invalid source package manifest: ${manifestPath}`,
          undefined,
          "Expected a JSON object."
        )
      );
    }
    return ok(parsed as SourcePackageManifest);
  } catch (err) {
    return error(
      createDiagnostic(
        "TSN1004",
        "error",
        `Failed to parse source package manifest: ${manifestPath}`,
        undefined,
        err instanceof Error ? err.message : String(err)
      )
    );
  }
};

const parseSurfaces = (
  value: unknown,
  manifestPath: string
): Result<readonly string[], Diagnostic> => {
  if (!Array.isArray(value) || value.length === 0) {
    return error(
      createDiagnostic(
        "TSN1004",
        "error",
        `Invalid source package manifest: ${manifestPath}`,
        undefined,
        "`surfaces` must be a non-empty string array."
      )
    );
  }

  const surfaces = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (surfaces.length !== value.length) {
    return error(
      createDiagnostic(
        "TSN1004",
        "error",
        `Invalid source package manifest: ${manifestPath}`,
        undefined,
        "`surfaces` entries must all be non-empty strings."
      )
    );
  }

  return ok(surfaces);
};

const parseSourceSection = (
  value: unknown,
  manifestPath: string
): Result<ParsedSourceSection, Diagnostic> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return error(
      createDiagnostic(
        "TSN1004",
        "error",
        `Invalid source package manifest: ${manifestPath}`,
        undefined,
        "`source` must be an object."
      )
    );
  }

  const exportsRaw = (value as { readonly exports?: unknown }).exports;
  if (
    exportsRaw === null ||
    typeof exportsRaw !== "object" ||
    Array.isArray(exportsRaw)
  ) {
    return error(
      createDiagnostic(
        "TSN1004",
        "error",
        `Invalid source package manifest: ${manifestPath}`,
        undefined,
        "`source.exports` must be an object."
      )
    );
  }

  const entries: Record<string, string> = {};
  for (const [key, target] of Object.entries(exportsRaw)) {
    if (!key.trim()) {
      return error(
        createDiagnostic(
          "TSN1004",
          "error",
          `Invalid source package manifest: ${manifestPath}`,
          undefined,
          "`source.exports` keys must be non-empty strings."
        )
      );
    }
    if (typeof target !== "string" || !target.trim()) {
      return error(
        createDiagnostic(
          "TSN1004",
          "error",
          `Invalid source package manifest: ${manifestPath}`,
          undefined,
          "`source.exports` values must be non-empty strings."
        )
      );
    }
    entries[key] = target.trim();
  }

  if (Object.keys(entries).length === 0) {
    return error(
      createDiagnostic(
        "TSN1004",
        "error",
        `Invalid source package manifest: ${manifestPath}`,
        undefined,
        "`source.exports` must declare at least one export."
      )
    );
  }

  return ok({ exports: entries });
};

const resolveExportTarget = (
  packageRoot: string,
  target: string
): Result<string, Diagnostic> => {
  if (path.isAbsolute(target)) {
    return error(
      createDiagnostic(
        "TSN1004",
        "error",
        `Invalid source package export target: ${target}`,
        undefined,
        "Export targets must be package-relative paths."
      )
    );
  }

  const absolute = path.resolve(packageRoot, target);
  const relativeToRoot = path.relative(packageRoot, absolute);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    return error(
      createDiagnostic(
        "TSN1004",
        "error",
        `Invalid source package export target: ${target}`,
        undefined,
        "Export targets must stay within the package root."
      )
    );
  }

  if (
    !absolute.endsWith(".ts") &&
    !absolute.endsWith(".mts") &&
    !absolute.endsWith(".cts")
  ) {
    return error(
      createDiagnostic(
        "TSN1004",
        "error",
        `Invalid source package export target: ${target}`,
        undefined,
        "Export targets must point to TypeScript source files."
      )
    );
  }

  if (!fs.existsSync(absolute)) {
    return error(
      createDiagnostic(
        "TSN1004",
        "error",
        `Cannot find source package export target: ${target}`,
        undefined,
        `Expected file at ${absolute}`
      )
    );
  }

  return ok(absolute);
};

const resolveSourcePackageImportFromRoot = (
  parsedSpecifier: {
    readonly packageName: string;
    readonly subpath: string | undefined;
  },
  packageRoot: string,
  activeSurface: SurfaceMode | undefined,
  projectRoot: string
): Result<ResolvedSourcePackageImport | null, Diagnostic> => {
  const manifestPath = path.join(
    packageRoot,
    "tsonic.package.json"
  );
  const manifestResult = readManifest(manifestPath);
  if (!manifestResult.ok) return manifestResult;
  const manifest = manifestResult.value;
  if (!manifest) {
    return ok(null);
  }

  if (manifest.schemaVersion !== 1) {
    return error(
      createDiagnostic(
        "TSN1004",
        "error",
        `Invalid source package manifest: ${manifestPath}`,
        undefined,
        "schemaVersion must be 1."
      )
    );
  }

  if (manifest.kind !== "tsonic-source-package") {
    return ok(null);
  }

  const surfaces = parseSurfaces(manifest.surfaces, manifestPath);
  if (!surfaces.ok) return surfaces;

  const activeModes = new Set(
    resolveSurfaceCapabilities(activeSurface ?? "clr", {
      projectRoot,
    }).resolvedModes
  );

  if (!surfaces.value.some((surface) => activeModes.has(surface))) {
    return error(
      createDiagnostic(
        "TSN1004",
        "error",
        `Source package '${parsedSpecifier.packageName}' is not compatible with surface '${activeSurface ?? "clr"}'`,
        undefined,
        `Supported surfaces: ${surfaces.value.join(", ")}`
      )
    );
  }

  const source = parseSourceSection(manifest.source, manifestPath);
  if (!source.ok) return source;

  const exportKey =
    parsedSpecifier.subpath && parsedSpecifier.subpath.length > 0
      ? `./${parsedSpecifier.subpath}`
      : ".";
  const target = source.value.exports[exportKey];
  if (!target) {
    return error(
      createDiagnostic(
        "TSN1004",
        "error",
        `Source package export '${exportKey}' not found in '${parsedSpecifier.packageName}'`,
        undefined,
        `Declare it in ${path.relative(packageRoot, manifestPath)} under source.exports.`
      )
    );
  }

  const resolvedTarget = resolveExportTarget(packageRoot, target);
  if (!resolvedTarget.ok) return resolvedTarget;

  return ok({
    packageName: parsedSpecifier.packageName,
    packageRoot,
    resolvedPath: resolvedTarget.value,
  });
};

export const resolveSourcePackageImportFromPackageRoot = (
  importSpecifier: string,
  packageRoot: string,
  activeSurface: SurfaceMode | undefined,
  projectRoot: string
): Result<ResolvedSourcePackageImport | null, Diagnostic> => {
  const parsedSpecifier = parsePackageSpecifier(importSpecifier);
  if (!parsedSpecifier) {
    return ok(null);
  }

  return resolveSourcePackageImportFromRoot(
    parsedSpecifier,
    packageRoot,
    activeSurface,
    projectRoot
  );
};

export const resolveSourcePackageImport = (
  importSpecifier: string,
  containingFile: string,
  activeSurface: SurfaceMode | undefined,
  projectRoot: string
): Result<ResolvedSourcePackageImport | null, Diagnostic> => {
  const parsedSpecifier = parsePackageSpecifier(importSpecifier);
  if (!parsedSpecifier) {
    return ok(null);
  }

  const packageRoot = findInstalledPackageRoot(
    parsedSpecifier.packageName,
    containingFile
  );
  if (!packageRoot) {
    return ok(null);
  }

  const resolvedFromInstalledRoot = resolveSourcePackageImportFromRoot(
    parsedSpecifier,
    packageRoot,
    activeSurface,
    projectRoot
  );
  if (!resolvedFromInstalledRoot.ok || resolvedFromInstalledRoot.value) {
    return resolvedFromInstalledRoot;
  }

  const containingSourcePackageRoot =
    findContainingSourcePackageRoot(containingFile);
  if (!containingSourcePackageRoot) {
    return resolvedFromInstalledRoot;
  }

  const siblingDependencyRoot = resolveDependencyPackageRoot(
    containingSourcePackageRoot,
    parsedSpecifier.packageName,
    "sibling-first"
  );
  if (
    !siblingDependencyRoot ||
    path.resolve(siblingDependencyRoot) === path.resolve(packageRoot)
  ) {
    return resolvedFromInstalledRoot;
  }

  return resolveSourcePackageImportFromRoot(
    parsedSpecifier,
    siblingDependencyRoot,
    activeSurface,
    projectRoot
  );
};

export const __resetSourcePackageResolutionCachesForTests = (): void => {
  installedPackageRootCache.clear();
  containingSourcePackageRootCache.clear();
};
