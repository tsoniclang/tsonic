/**
 * CLR bindings resolution for package imports
 *
 * Determines if an import specifier refers to a CLR namespace by checking
 * if bindings.json exists in the package's namespace directory.
 *
 * This is the ONLY mechanism for detecting CLR imports - no heuristics,
 * no special-casing for any particular package. Any package that provides
 * bindings.json in its namespace directories will be recognized.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

/**
 * Result of resolving a CLR import
 */
export type ResolvedClrImport =
  | {
      readonly isClr: true;
      readonly packageName: string;
      readonly resolvedNamespace: string;
      readonly bindingsPath: string;
      readonly metadataPath: string | undefined;
      readonly assembly: string | undefined;
    }
  | {
      readonly isClr: false;
    };

/**
 * Parsed module specifier
 */
type ParsedSpecifier = {
  readonly packageName: string;
  readonly subpath: string;
};

/**
 * Resolver for CLR namespace imports
 *
 * An import is a CLR namespace import iff:
 * - It's a package import with a subpath (e.g., @scope/pkg/Namespace)
 * - The package contains bindings.json in that subpath directory
 *
 * This works for any bindings provider package.
 */
export class ClrBindingsResolver {
  // Cache: packageName -> packageRoot (or null if not found)
  private readonly pkgRootCache = new Map<string, string | null>();

  // Cache: absolute bindingsPath -> exists
  private readonly bindingsExistsCache = new Map<string, boolean>();

  // Cache: absolute bindingsPath -> namespace (extracted from bindings.json)
  private readonly namespaceCache = new Map<string, string | null>();

  // Cache: absolute bindingsPath -> assembly (extracted from bindings.json types)
  private readonly assemblyCache = new Map<string, string | null>();

  // require function for Node resolution from the base directory
  private readonly require: ReturnType<typeof createRequire>;

  constructor(baseDir: string) {
    // Create a require function that resolves relative to baseDir
    this.require = createRequire(join(baseDir, "package.json"));
  }

  /**
   * Resolve an import specifier to determine if it's a CLR namespace import
   */
  resolve(moduleSpecifier: string): ResolvedClrImport {
    // Skip local imports
    if (moduleSpecifier.startsWith(".") || moduleSpecifier.startsWith("/")) {
      return { isClr: false };
    }

    // Parse the specifier into package name and subpath
    const parsed = this.parseModuleSpecifier(moduleSpecifier);
    if (!parsed) {
      return { isClr: false };
    }

    const { packageName, subpath } = parsed;

    // No subpath means it's not a namespace import (e.g., just "@scope/pkg")
    if (!subpath) {
      return { isClr: false };
    }

    // Resolve package root using Node resolution
    const pkgRoot = this.resolvePkgRoot(packageName);
    if (!pkgRoot) {
      return { isClr: false };
    }

    // Strip .js extension from subpath (e.g., "nodejs.js" -> "nodejs")
    // This allows imports like "@tsonic/nodejs/nodejs.js" to find "nodejs/bindings.json"
    const namespaceDir = subpath.endsWith(".js")
      ? subpath.slice(0, -3)
      : subpath;

    // Check if bindings.json exists in the namespace directory
    const bindingsPath = join(pkgRoot, namespaceDir, "bindings.json");
    if (!this.hasBindings(bindingsPath)) {
      return { isClr: false };
    }

    // Extract namespace from bindings.json (tsbindgen format)
    // This is the authoritative namespace, not the subpath
    const resolvedNamespace = this.extractNamespace(bindingsPath, namespaceDir);

    // Check for optional metadata.json
    const metadataPath = join(
      pkgRoot,
      namespaceDir,
      "internal",
      "metadata.json"
    );
    const hasMetadata = this.fileExists(metadataPath);

    // Extract assembly name from bindings.json types
    const assembly = this.extractAssembly(bindingsPath);

    return {
      isClr: true,
      packageName,
      resolvedNamespace,
      bindingsPath,
      metadataPath: hasMetadata ? metadataPath : undefined,
      assembly,
    };
  }

  /**
   * Parse a module specifier into package name and subpath
   *
   * Examples:
   * - "@scope/pkg/System.IO" -> { packageName: "@scope/pkg", subpath: "System.IO" }
   * - "mypkg/Namespace" -> { packageName: "mypkg", subpath: "Namespace" }
   * - "@scope/pkg" -> null (no subpath)
   * - "mypkg" -> null (no subpath)
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
   * Extract the namespace from a bindings.json file (cached).
   * Falls back to the subpath if namespace cannot be extracted.
   *
   * This reads the 'namespace' field from tsbindgen format files,
   * which is the authoritative CLR namespace for the binding.
   */
  private extractNamespace(bindingsPath: string, fallback: string): string {
    const cached = this.namespaceCache.get(bindingsPath);
    if (cached !== undefined) {
      return cached ?? fallback;
    }

    try {
      const content = readFileSync(bindingsPath, "utf-8");
      const parsed = JSON.parse(content) as unknown;

      // Check for tsbindgen format: { namespace: string, types: [...] }
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        "namespace" in parsed &&
        typeof (parsed as Record<string, unknown>).namespace === "string"
      ) {
        const namespace = (parsed as Record<string, unknown>)
          .namespace as string;
        this.namespaceCache.set(bindingsPath, namespace);
        return namespace;
      }

      // No namespace found, cache null and fall back
      this.namespaceCache.set(bindingsPath, null);
      return fallback;
    } catch {
      // Failed to read/parse, cache null and fall back
      this.namespaceCache.set(bindingsPath, null);
      return fallback;
    }
  }

  /**
   * Extract the assembly name from a bindings.json file (cached).
   * Looks at the first type's assemblyName field.
   *
   * This provides the assembly name for reference in .csproj files.
   */
  private extractAssembly(bindingsPath: string): string | undefined {
    const cached = this.assemblyCache.get(bindingsPath);
    if (cached !== undefined) {
      return cached ?? undefined;
    }

    try {
      const content = readFileSync(bindingsPath, "utf-8");
      const parsed = JSON.parse(content) as unknown;

      // Check for tsbindgen format: { namespace: string, types: [...] }
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        "types" in parsed &&
        Array.isArray((parsed as Record<string, unknown>).types)
      ) {
        const types = (parsed as Record<string, unknown>).types as unknown[];
        if (types.length > 0) {
          const firstType = types[0] as Record<string, unknown>;
          if (typeof firstType.assemblyName === "string") {
            const assembly = firstType.assemblyName;
            this.assemblyCache.set(bindingsPath, assembly);
            return assembly;
          }
        }
      }

      // No assembly found, cache null
      this.assemblyCache.set(bindingsPath, null);
      return undefined;
    } catch {
      // Failed to read/parse, cache null
      this.assemblyCache.set(bindingsPath, null);
      return undefined;
    }
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
export const createClrBindingsResolver = (
  sourceRoot: string
): ClrBindingsResolver => {
  return new ClrBindingsResolver(sourceRoot);
};
