/**
 * External Bindings Package Resolution
 *
 * Package root resolution, bindings.json discovery, and metadata extraction
 * (namespace, ownerIdentity) for external bindings packages.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import {
  extractRawExternalBindingsPayload,
  extractRawExternalOwnerIdentity,
} from "../program/external-binding-payload.js";

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
    const payload = extractRawExternalBindingsPayload(parsed);

    if (payload) {
      namespaceCache.set(bindingsPath, payload.namespace);
      return payload.namespace;
    }

    namespaceCache.set(bindingsPath, null);
    return undefined;
  } catch {
    namespaceCache.set(bindingsPath, null);
    return undefined;
  }
};

/**
 * Extract the provider owner identity from a bindings.json file (cached).
 */
export const extractOwnerIdentity = (
  bindingsPath: string,
  ownerIdentityCache: Map<string, string | null>
): string | undefined => {
  const cached = ownerIdentityCache.get(bindingsPath);
  if (cached !== undefined) {
    return cached ?? undefined;
  }

  try {
    const content = readFileSync(bindingsPath, "utf-8");
    const parsed = JSON.parse(content) as unknown;

    const ownerIdentity = extractRawExternalOwnerIdentity(parsed);
    if (ownerIdentity) {
      ownerIdentityCache.set(bindingsPath, ownerIdentity);
      return ownerIdentity;
    }

    ownerIdentityCache.set(bindingsPath, null);
    return undefined;
  } catch {
    // Failed to read/parse, cache null
    ownerIdentityCache.set(bindingsPath, null);
    return undefined;
  }
};
