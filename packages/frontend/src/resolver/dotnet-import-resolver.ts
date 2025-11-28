/**
 * Import-driven .NET namespace resolution
 *
 * Determines if an import specifier refers to a CLR namespace by checking
 * if bindings.json exists in the package's namespace directory.
 *
 * This is the ONLY mechanism for detecting .NET imports - no heuristics,
 * no special-casing for @tsonic/dotnet or any other package.
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

/**
 * Result of resolving a .NET import
 */
export type ResolvedDotNetImport =
  | {
      readonly isDotNet: true;
      readonly packageName: string;
      readonly resolvedNamespace: string;
      readonly bindingsPath: string;
      readonly metadataPath: string | undefined;
    }
  | {
      readonly isDotNet: false;
    };

/**
 * Parsed module specifier
 */
type ParsedSpecifier = {
  readonly packageName: string;
  readonly subpath: string;
};

/**
 * Resolver for .NET namespace imports
 *
 * An import is a CLR namespace import iff:
 * - It's a package import with a subpath (e.g., @scope/pkg/Namespace)
 * - The package contains bindings.json in that subpath directory
 *
 * This works for any bindings provider package, not just @tsonic/dotnet.
 */
export class DotNetImportResolver {
  // Cache: packageName -> packageRoot (or null if not found)
  private readonly pkgRootCache = new Map<string, string | null>();

  // Cache: absolute bindingsPath -> exists
  private readonly bindingsExistsCache = new Map<string, boolean>();

  // require function for Node resolution from the base directory
  private readonly require: NodeRequire;

  constructor(baseDir: string) {
    // Create a require function that resolves relative to baseDir
    this.require = createRequire(join(baseDir, "package.json"));
  }

  /**
   * Resolve an import specifier to determine if it's a CLR namespace import
   */
  resolve(moduleSpecifier: string): ResolvedDotNetImport {
    // Skip local imports
    if (moduleSpecifier.startsWith(".") || moduleSpecifier.startsWith("/")) {
      return { isDotNet: false };
    }

    // Parse the specifier into package name and subpath
    const parsed = this.parseModuleSpecifier(moduleSpecifier);
    if (!parsed) {
      return { isDotNet: false };
    }

    const { packageName, subpath } = parsed;

    // No subpath means it's not a namespace import (e.g., just "@tsonic/dotnet")
    if (!subpath) {
      return { isDotNet: false };
    }

    // Resolve package root using Node resolution
    const pkgRoot = this.resolvePkgRoot(packageName);
    if (!pkgRoot) {
      return { isDotNet: false };
    }

    // Check if bindings.json exists in the namespace directory
    const bindingsPath = join(pkgRoot, subpath, "bindings.json");
    if (!this.hasBindings(bindingsPath)) {
      return { isDotNet: false };
    }

    // Check for optional metadata.json
    const metadataPath = join(pkgRoot, subpath, "internal", "metadata.json");
    const hasMetadata = this.fileExists(metadataPath);

    return {
      isDotNet: true,
      packageName,
      resolvedNamespace: subpath,
      bindingsPath,
      metadataPath: hasMetadata ? metadataPath : undefined,
    };
  }

  /**
   * Parse a module specifier into package name and subpath
   *
   * Examples:
   * - "@tsonic/dotnet/System.IO" -> { packageName: "@tsonic/dotnet", subpath: "System.IO" }
   * - "lodash/fp" -> { packageName: "lodash", subpath: "fp" }
   * - "@tsonic/dotnet" -> null (no subpath)
   * - "lodash" -> null (no subpath)
   */
  private parseModuleSpecifier(spec: string): ParsedSpecifier | null {
    if (spec.startsWith("@")) {
      // Scoped package: @scope/pkg/subpath
      const match = spec.match(/^(@[^/]+\/[^/]+)(?:\/(.+))?$/);
      if (!match) return null;
      const packageName = match[1];
      const subpath = match[2];
      if (!packageName || !subpath) return null;
      return { packageName, subpath };
    } else {
      // Regular package: pkg/subpath
      const slashIdx = spec.indexOf("/");
      if (slashIdx === -1) return null;
      return {
        packageName: spec.slice(0, slashIdx),
        subpath: spec.slice(slashIdx + 1),
      };
    }
  }

  /**
   * Resolve package root directory using Node resolution
   *
   * Uses require.resolve to find the package's package.json,
   * then returns the directory containing it.
   */
  private resolvePkgRoot(packageName: string): string | null {
    const cached = this.pkgRootCache.get(packageName);
    if (cached !== undefined) {
      return cached;
    }

    try {
      // Try to resolve the package's package.json directly
      const pkgJsonPath = this.require.resolve(`${packageName}/package.json`);
      const pkgRoot = dirname(pkgJsonPath);
      this.pkgRootCache.set(packageName, pkgRoot);
      return pkgRoot;
    } catch {
      // package.json might not be exported - try finding package root via node_modules path
      // This works by looking for node_modules/<package-name> in the require paths
      try {
        const paths = this.require.resolve.paths(packageName);
        if (paths) {
          for (const searchPath of paths) {
            // For scoped packages, the path structure is node_modules/@scope/name
            const pkgDir = packageName.startsWith("@")
              ? join(searchPath, packageName)
              : join(searchPath, packageName);

            // Check if package.json exists at this location
            if (existsSync(join(pkgDir, "package.json"))) {
              this.pkgRootCache.set(packageName, pkgDir);
              return pkgDir;
            }
          }
        }
      } catch {
        // Fallback failed
      }

      this.pkgRootCache.set(packageName, null);
      return null;
    }
  }

  /**
   * Check if bindings.json exists at the given path (cached)
   */
  private hasBindings(bindingsPath: string): boolean {
    const cached = this.bindingsExistsCache.get(bindingsPath);
    if (cached !== undefined) {
      return cached;
    }

    const exists = existsSync(bindingsPath);
    this.bindingsExistsCache.set(bindingsPath, exists);
    return exists;
  }

  /**
   * Check if a file exists (not cached - used for optional files)
   */
  private fileExists(filePath: string): boolean {
    return existsSync(filePath);
  }

  /**
   * Get all discovered binding paths (for loading)
   */
  getDiscoveredBindingPaths(): ReadonlySet<string> {
    const paths = new Set<string>();
    for (const [path, exists] of this.bindingsExistsCache) {
      if (exists) {
        paths.add(path);
      }
    }
    return paths;
  }
}

/**
 * Create a resolver instance for a given source root
 */
export const createDotNetImportResolver = (
  sourceRoot: string
): DotNetImportResolver => {
  return new DotNetImportResolver(sourceRoot);
};
