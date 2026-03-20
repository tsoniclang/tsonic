/**
 * CLR Bindings Package Resolution
 *
 * Package root resolution, bindings.json discovery, and metadata extraction
 * (namespace, assembly) for CLR bindings packages.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const extractBindingsTypes = (
  parsed: unknown
): readonly Record<string, unknown>[] | undefined => {
  if (parsed === null || typeof parsed !== "object") {
    return undefined;
  }
  const record = parsed as Record<string, unknown>;
  if (Array.isArray(record.types)) {
    return record.types.filter(
      (entry): entry is Record<string, unknown> =>
        entry !== null && typeof entry === "object" && !Array.isArray(entry)
    );
  }
  const dotnet = record.dotnet;
  if (
    dotnet !== null &&
    typeof dotnet === "object" &&
    !Array.isArray(dotnet) &&
    Array.isArray((dotnet as { readonly types?: unknown }).types)
  ) {
    return (dotnet as { readonly types: unknown[] }).types.filter(
      (entry): entry is Record<string, unknown> =>
        entry !== null && typeof entry === "object" && !Array.isArray(entry)
    );
  }
  return undefined;
};

/**
 * Resolve package root directory using Node resolution.
 *
 * Uses require.resolve to find the package's package.json,
 * then returns the directory containing it.
 */
export const resolvePkgRoot = (
  packageName: string,
  pkgRootCache: Map<string, string | null>,
  mainRequire: ReturnType<typeof createRequire>,
  compilerRequire: ReturnType<typeof createRequire>
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

  const resolveFromSiblingCheckout = (): string | null => {
    if (!packageName.startsWith("@tsonic/")) return null;
    const match = packageName.match(/^@tsonic\/([^/]+)$/);
    if (!match) return null;

    const pkgDirName = match[1];
    if (!pkgDirName) return null;
    const expectedName = `@tsonic/${pkgDirName}`;
    const here = fileURLToPath(import.meta.url);
    // <repoRoot>/packages/frontend/src/resolver/clr-bindings-package-resolution.ts
    const repoRoot = dirname(dirname(dirname(dirname(dirname(here)))));
    const siblingRepoRoot = join(repoRoot, "..", pkgDirName);

    const readPackageName = (pkgJsonPath: string): string | null => {
      if (!existsSync(pkgJsonPath)) return null;
      try {
        const raw = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as {
          readonly name?: unknown;
        };
        return typeof raw.name === "string" ? raw.name : null;
      } catch {
        return null;
      }
    };

    const repoPackageName = readPackageName(
      join(siblingRepoRoot, "package.json")
    );
    if (repoPackageName === expectedName) return siblingRepoRoot;

    const versionsRoot = join(siblingRepoRoot, "versions");
    if (!existsSync(versionsRoot)) return null;

    const sorted = readdirSync(versionsRoot, { withFileTypes: true })
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

    for (const versionDir of sorted) {
      const candidateRoot = join(versionsRoot, versionDir);
      const candidateName = readPackageName(
        join(candidateRoot, "package.json")
      );
      if (candidateName === expectedName) return candidateRoot;
    }

    return null;
  };

  const direct = resolveViaRequire(mainRequire);
  if (direct) {
    pkgRootCache.set(packageName, direct);
    return direct;
  }

  if (packageName.startsWith("@tsonic/")) {
    const compilerDirect = resolveViaRequire(compilerRequire);
    if (compilerDirect) {
      pkgRootCache.set(packageName, compilerDirect);
      return compilerDirect;
    }
  }

  const fromPaths = resolveViaSearchPaths(
    mainRequire.resolve.paths(packageName)
  );
  if (fromPaths) {
    pkgRootCache.set(packageName, fromPaths);
    return fromPaths;
  }

  if (packageName.startsWith("@tsonic/")) {
    const fromCompilerPaths = resolveViaSearchPaths(
      compilerRequire.resolve.paths(packageName)
    );
    if (fromCompilerPaths) {
      pkgRootCache.set(packageName, fromCompilerPaths);
      return fromCompilerPaths;
    }
  }

  const sibling = resolveFromSiblingCheckout();
  if (sibling) {
    pkgRootCache.set(packageName, sibling);
    return sibling;
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
 * Falls back to the subpath if namespace cannot be extracted.
 */
export const extractNamespace = (
  bindingsPath: string,
  fallback: string,
  namespaceCache: Map<string, string | null>
): string => {
  const cached = namespaceCache.get(bindingsPath);
  if (cached !== undefined) {
    return cached ?? fallback;
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

    // No namespace found, cache null and fall back
    namespaceCache.set(bindingsPath, null);
    return fallback;
  } catch {
    // Failed to read/parse, cache null and fall back
    namespaceCache.set(bindingsPath, null);
    return fallback;
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

    const types = extractBindingsTypes(parsed);
    if (types) {
      const [firstType] = types;
      if (firstType && typeof firstType.assemblyName === "string") {
        const assembly = firstType.assemblyName;
        assemblyCache.set(bindingsPath, assembly);
        return assembly;
      }
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
