/**
 * Module resolution helpers for Tsonic program creation.
 *
 * Provides package-root resolution, @tsonic/* module resolution,
 * and namespace remapping logic.
 */

import * as path from "node:path";
import * as fs from "node:fs";
import { readSourcePackageMetadata } from "./source-package-metadata.js";

export type ResolvedPackageModuleExtension =
  | ".d.ts"
  | ".ts"
  | ".js"
  | ".mts"
  | ".cts";

export type ResolvedPackageModule = {
  readonly resolvedFileName: string;
  readonly extension: ResolvedPackageModuleExtension;
  readonly isExternalLibraryImport: boolean;
};

const resolvePackageModuleExtension = (
  filePath: string
): ResolvedPackageModuleExtension | undefined => {
  if (filePath.endsWith(".d.ts")) return ".d.ts";
  if (filePath.endsWith(".mts")) return ".mts";
  if (filePath.endsWith(".cts")) return ".cts";
  if (filePath.endsWith(".ts")) return ".ts";
  if (filePath.endsWith(".js")) return ".js";
  return undefined;
};

/**
 * Read the `name` field from a package.json file.
 */
export const readPackageName = (pkgJsonPath: string): string | undefined => {
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

/**
 * Read the root namespace from a package's native source-package metadata.
 */
export const createReadPackageRootNamespace = (
  packageRootNamespaceCache: Map<string, string | null>
): ((packageRoot: string) => string | undefined) => {
  const readPackageRootNamespace = (
    packageRoot: string
  ): string | undefined => {
    const cached = packageRootNamespaceCache.get(packageRoot);
    if (cached !== undefined) {
      return cached ?? undefined;
    }

    const sourceMetadata = readSourcePackageMetadata(packageRoot);
    if (sourceMetadata?.namespace) {
      packageRootNamespaceCache.set(packageRoot, sourceMetadata.namespace);
      return sourceMetadata.namespace;
    }

    packageRootNamespaceCache.set(packageRoot, null);
    return undefined;
  };

  return readPackageRootNamespace;
};

/**
 * Parse a `@tsonic/*` module request into its components.
 */
export const parseTsonicModuleRequest = (
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

/**
 * Resolve a module from a package root by trying candidate file paths.
 */
export const createResolveModuleFromPackageRoot = (
  packageRootModuleResolutionCache: Map<string, ResolvedPackageModule | null>,
  readPackageRootNamespace: (packageRoot: string) => string | undefined
): ((
  packageRoot: string,
  subpath: string | undefined
) => ResolvedPackageModule | undefined) => {
  const tryResolveExportTarget = (
    packageRoot: string,
    target: unknown
  ): ResolvedPackageModule | undefined => {
    if (typeof target !== "string" || target.length === 0) {
      return undefined;
    }

    const candidate = path.resolve(packageRoot, target);
    if (!fs.existsSync(candidate)) {
      return undefined;
    }

    const extension = resolvePackageModuleExtension(candidate);
    if (!extension) {
      return undefined;
    }

    return {
      resolvedFileName: candidate,
      extension,
      isExternalLibraryImport: true,
    };
  };

  const tryResolveFromPackageJsonExports = (
    packageRoot: string,
    subpath: string | undefined
  ): ResolvedPackageModule | undefined => {
    const packageJsonPath = path.join(packageRoot, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as {
        readonly exports?: Record<string, unknown>;
      };
      const exportsField = parsed.exports;
      if (
        exportsField === null ||
        typeof exportsField !== "object" ||
        Array.isArray(exportsField)
      ) {
        return undefined;
      }

      const exportKey = subpath && subpath.length > 0 ? `./${subpath}` : ".";
      const rawTarget = exportsField[exportKey];
      if (rawTarget === undefined) {
        return undefined;
      }

      if (typeof rawTarget === "string") {
        return tryResolveExportTarget(packageRoot, rawTarget);
      }

      if (
        rawTarget !== null &&
        typeof rawTarget === "object" &&
        !Array.isArray(rawTarget)
      ) {
        const resolvedFromTypes = tryResolveExportTarget(
          packageRoot,
          (rawTarget as { readonly types?: unknown }).types
        );
        if (resolvedFromTypes) {
          return resolvedFromTypes;
        }

        return tryResolveExportTarget(
          packageRoot,
          (rawTarget as { readonly default?: unknown }).default
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to read package manifest '${packageJsonPath}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return undefined;
  };

  const tryResolveFromSourceManifest = (
    packageRoot: string,
    subpath: string | undefined
  ): ResolvedPackageModule | undefined => {
    const manifestPath = path.join(packageRoot, "tsonic.package.json");
    if (!fs.existsSync(manifestPath)) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
        readonly source?: {
          readonly exports?: Record<string, unknown>;
        };
      };
      const exportsField = parsed.source?.exports;
      if (
        exportsField === null ||
        typeof exportsField !== "object" ||
        Array.isArray(exportsField)
      ) {
        return undefined;
      }

      const exportKey = subpath && subpath.length > 0 ? `./${subpath}` : ".";
      return tryResolveExportTarget(packageRoot, exportsField[exportKey]);
    } catch (error) {
      throw new Error(
        `Failed to read source package manifest '${manifestPath}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  const resolveModuleFromPackageRoot = (
    packageRoot: string,
    subpath: string | undefined
  ): ResolvedPackageModule | undefined => {
    const cacheKey = `${path.resolve(packageRoot)}::${subpath ?? "."}`;
    const cached = packageRootModuleResolutionCache.get(cacheKey);
    if (cached !== undefined) {
      return cached ?? undefined;
    }

    const sourcePackageMetadata = readSourcePackageMetadata(packageRoot);
    const exportedResolution = sourcePackageMetadata
      ? (tryResolveFromSourceManifest(packageRoot, subpath) ??
        tryResolveFromPackageJsonExports(packageRoot, subpath))
      : (tryResolveFromPackageJsonExports(packageRoot, subpath) ??
        tryResolveFromSourceManifest(packageRoot, subpath));
    if (exportedResolution) {
      packageRootModuleResolutionCache.set(cacheKey, exportedResolution);
      return exportedResolution;
    }

    if (sourcePackageMetadata) {
      packageRootModuleResolutionCache.set(cacheKey, null);
      return undefined;
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

      const extension = resolvePackageModuleExtension(candidate);
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

  return resolveModuleFromPackageRoot;
};
