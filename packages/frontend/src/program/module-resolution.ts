/**
 * Module resolution helpers for Tsonic program creation.
 *
 * Provides package-root resolution, @tsonic/* module resolution,
 * sibling and compiler-owned package discovery, and namespace
 * remapping logic.
 */

import * as ts from "typescript";
import * as path from "node:path";
import * as fs from "node:fs";

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
 * Read the root namespace from a package's bindings.json.
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
  packageRootModuleResolutionCache: Map<string, ts.ResolvedModuleFull | null>,
  readPackageRootNamespace: (packageRoot: string) => string | undefined
): ((
  packageRoot: string,
  subpath: string | undefined
) => ts.ResolvedModuleFull | undefined) => {
  const tryResolveExportTarget = (
    packageRoot: string,
    target: unknown
  ): ts.ResolvedModuleFull | undefined => {
    if (typeof target !== "string" || target.length === 0) {
      return undefined;
    }

    const candidate = path.resolve(packageRoot, target);
    if (!fs.existsSync(candidate)) {
      return undefined;
    }

    const extension = candidate.endsWith(".d.ts")
      ? ts.Extension.Dts
      : candidate.endsWith(".ts")
        ? ts.Extension.Ts
        : candidate.endsWith(".js")
          ? ts.Extension.Js
          : candidate.endsWith(".mts")
            ? ts.Extension.Mts
            : candidate.endsWith(".cts")
              ? ts.Extension.Cts
              : undefined;

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
  ): ts.ResolvedModuleFull | undefined => {
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
    } catch {
      return undefined;
    }

    return undefined;
  };

  const tryResolveFromSourceManifest = (
    packageRoot: string,
    subpath: string | undefined
  ): ts.ResolvedModuleFull | undefined => {
    const manifestPath = path.join(
      packageRoot,
      "tsonic",
      "package-manifest.json"
    );
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
    } catch {
      return undefined;
    }
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

    const exportedResolution =
      tryResolveFromPackageJsonExports(packageRoot, subpath) ??
      tryResolveFromSourceManifest(packageRoot, subpath);
    if (exportedResolution) {
      packageRootModuleResolutionCache.set(cacheKey, exportedResolution);
      return exportedResolution;
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

  return resolveModuleFromPackageRoot;
};

/**
 * Resolve a sibling @tsonic package root from monorepo layout.
 */
export const createResolveSiblingTsonicPackageRoot = (
  siblingTsonicPackageRootCache: Map<string, string | null>,
  repoRoot: string
): ((pkgDirName: string) => string | undefined) => {
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

  return resolveSiblingTsonicPackageRoot;
};

/**
 * Resolve a compiler-owned @tsonic package root (sibling first, then installed).
 */
export const createResolveCompilerOwnedTsonicPackageRoot = (
  compilerOwnedTsonicPackageRootCache: Map<string, string | null>,
  resolveSiblingTsonicPackageRoot: (pkgDirName: string) => string | undefined,
  require: NodeRequire
): ((pkgDirName: string) => string | undefined) => {
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

  return resolveCompilerOwnedTsonicPackageRoot;
};
