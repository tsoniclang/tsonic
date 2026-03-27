/**
 * CLR Bindings Package Resolution
 *
 * Package root resolution, bindings.json discovery, and metadata extraction
 * (namespace, assembly) for CLR bindings packages.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { extractRawDotnetAssemblyName } from "../program/dotnet-binding-payload.js";

/**
 * Resolve package root directory using Node resolution.
 *
 * Uses require.resolve to find the package's package.json,
 * then returns the directory containing it.
 */
export const resolvePkgRoot = (
  packageName: string,
  pkgRootCache: Map<string, string | null>,
  mainRequire: ReturnType<typeof createRequire>
): string | null => {
  const cached = pkgRootCache.get(packageName);
  if (cached !== undefined) {
    return cached;
  }

  const resolveViaRequire = (
    req: ReturnType<typeof createRequire>
  ): string | null => {
    try {
      const pkgJsonPath = req.resolve(`${packageName}/package.json`);
      return dirname(pkgJsonPath);
    } catch {
      return null;
    }
  };

  const resolveViaSearchPaths = (
    paths: readonly string[] | null | undefined
  ): string | null => {
    if (!paths) return null;
    for (const searchPath of paths) {
      const pkgDir = join(searchPath, packageName);
      if (existsSync(join(pkgDir, "package.json"))) {
        return pkgDir;
      }
    }
    return null;
  };

  const direct = resolveViaRequire(mainRequire);
  if (direct) {
    pkgRootCache.set(packageName, direct);
    return direct;
  }

  const fromPaths = resolveViaSearchPaths(
    mainRequire.resolve.paths(packageName)
  );
  if (fromPaths) {
    pkgRootCache.set(packageName, fromPaths);
    return fromPaths;
  }

  pkgRootCache.set(packageName, null);
  return null;
};

/**
 * Check if bindings.json exists at the given path (cached)
 */
export const hasBindings = (
  bindingsPath: string,
  bindingsExistsCache: Map<string, boolean>
): boolean => {
  const cached = bindingsExistsCache.get(bindingsPath);
  if (cached !== undefined) {
    return cached;
  }

  const exists = existsSync(bindingsPath);
  bindingsExistsCache.set(bindingsPath, exists);
  return exists;
};

/**
 * Extract the namespace from a bindings.json file (cached).
 */
export const extractNamespace = (
  bindingsPath: string,
  namespaceCache: Map<string, string | null>
): string | undefined => {
  const cached = namespaceCache.get(bindingsPath);
  if (cached !== undefined) {
    return cached ?? undefined;
  }

  try {
    const content = readFileSync(bindingsPath, "utf-8");
    const parsed = JSON.parse(content) as unknown;

    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "namespace" in parsed &&
      typeof (parsed as Record<string, unknown>).namespace === "string"
    ) {
      const namespace = (parsed as Record<string, unknown>).namespace as string;
      namespaceCache.set(bindingsPath, namespace);
      return namespace;
    }

    namespaceCache.set(bindingsPath, null);
    return undefined;
  } catch {
    namespaceCache.set(bindingsPath, null);
    return undefined;
  }
};

/**
 * Extract the assembly name from a bindings.json file (cached).
 * Looks at the first type's assemblyName field.
 */
export const extractAssembly = (
  bindingsPath: string,
  assemblyCache: Map<string, string | null>
): string | undefined => {
  const cached = assemblyCache.get(bindingsPath);
  if (cached !== undefined) {
    return cached ?? undefined;
  }

  try {
    const content = readFileSync(bindingsPath, "utf-8");
    const parsed = JSON.parse(content) as unknown;

    const assembly = extractRawDotnetAssemblyName(parsed);
    if (assembly) {
      assemblyCache.set(bindingsPath, assembly);
      return assembly;
    }

    // No assembly found, cache null
    assemblyCache.set(bindingsPath, null);
    return undefined;
  } catch {
    // Failed to read/parse, cache null
    assemblyCache.set(bindingsPath, null);
    return undefined;
  }
};
