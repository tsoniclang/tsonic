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
import { fileURLToPath } from "node:url";

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

  // Cache: module specifier -> resolved absolute path (or null if not found)
  private readonly resolvedPathCache = new Map<string, string | null>();

  // require function for Node resolution from the base directory
  private readonly require: ReturnType<typeof createRequire>;
  // Fallback require for compiler-owned @tsonic/* packages
  private readonly compilerRequire: ReturnType<typeof createRequire>;

  constructor(baseDir: string) {
    // Create a require function that resolves relative to baseDir
    this.require = createRequire(join(baseDir, "package.json"));
    this.compilerRequire = createRequire(import.meta.url);
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

    // Extract the namespace key from the import subpath.
    // Examples:
    // - "System.Linq.js" -> "System.Linq"
    // - "Microsoft.EntityFrameworkCore/internal/index.js" -> "Microsoft.EntityFrameworkCore"
    const namespaceKey = this.extractNamespaceKey(subpath);
    if (!namespaceKey) return { isClr: false };

    // Prefer exports-aware resolution:
    // - Resolve the namespace facade "@pkg/<Namespace>.js" via Node resolution (honors package.json exports).
    // - Find bindings.json relative to the resolved facade path.
    //
    // This supports bindings packages that keep generated artifacts under dist/ (not committed),
    // while keeping ergonomic imports like "@pkg/System.Linq.js".
    const facadeSpecifier = `${packageName}/${namespaceKey}.js`;
    const resolvedFacadePath = this.resolveModulePath(
      packageName,
      facadeSpecifier
    );

    // Resolve package root using Node resolution (for bounding searches).
    const pkgRoot = this.resolvePkgRoot(packageName);
    if (!pkgRoot) {
      return { isClr: false };
    }

    const bindingsPath =
      resolvedFacadePath &&
      this.findBindingsPathFromFacade({
        pkgRoot,
        namespaceKey,
        resolvedFacadePath,
      });

    // Fallback for packages that do not provide a resolvable facade stub.
    // This preserves legacy behavior where bindings are discovered purely by
    // "<pkgRoot>/<subpath>/bindings.json" without consulting exports.
    const legacyBindingsPath =
      bindingsPath ?? this.findBindingsPathLegacy(pkgRoot, subpath);

    if (!legacyBindingsPath) {
      return { isClr: false };
    }

    const bindingsDirAbs = dirname(legacyBindingsPath);

    // Extract namespace from bindings.json (tsbindgen format)
    // This is the authoritative namespace, not the subpath
    const resolvedNamespace = this.extractNamespace(
      legacyBindingsPath,
      namespaceKey
    );

    // Check for optional metadata.json
    const metadataPath = join(bindingsDirAbs, "internal", "metadata.json");
    const hasMetadata = this.fileExists(metadataPath);

    // Extract assembly name from bindings.json types
    const assembly = this.extractAssembly(legacyBindingsPath);

    return {
      isClr: true,
      packageName,
      resolvedNamespace,
      bindingsPath: legacyBindingsPath,
      metadataPath: hasMetadata ? metadataPath : undefined,
      assembly,
    };
  }

  private extractNamespaceKey(subpath: string): string | null {
    const slashIdx = subpath.indexOf("/");
    const backslashIdx = subpath.indexOf("\\");
    const firstSep =
      slashIdx === -1
        ? backslashIdx
        : backslashIdx === -1
          ? slashIdx
          : Math.min(slashIdx, backslashIdx);
    const firstSeg = (firstSep === -1 ? subpath : subpath.slice(0, firstSep)).trim();
    if (!firstSeg) return null;

    return firstSeg.endsWith(".js") ? firstSeg.slice(0, -3) : firstSeg;
  }

  private resolveModulePath(
    packageName: string,
    specifier: string
  ): string | null {
    const cached = this.resolvedPathCache.get(specifier);
    if (cached !== undefined) return cached;

    const resolveViaRequire = (
      req: ReturnType<typeof createRequire>
    ): string | null => {
      try {
        return req.resolve(specifier);
      } catch {
        return null;
      }
    };

    const direct = resolveViaRequire(this.require);
    if (direct) {
      this.resolvedPathCache.set(specifier, direct);
      return direct;
    }

    if (packageName.startsWith("@tsonic/")) {
      const compilerDirect = resolveViaRequire(this.compilerRequire);
      if (compilerDirect) {
        this.resolvedPathCache.set(specifier, compilerDirect);
        return compilerDirect;
      }
    }

    // Last-resort fallback for sibling checkouts of compiler-owned packages
    // (used in local development when packages are not installed).
    const pkgRoot = this.resolvePkgRoot(packageName);
    if (pkgRoot) {
      const subpath = specifier.slice(packageName.length + 1);
      const candidate = join(pkgRoot, subpath);
      if (existsSync(candidate)) {
        this.resolvedPathCache.set(specifier, candidate);
        return candidate;
      }
    }

    this.resolvedPathCache.set(specifier, null);
    return null;
  }

  private findBindingsPathFromFacade(opts: {
    readonly pkgRoot: string;
    readonly namespaceKey: string;
    readonly resolvedFacadePath: string;
  }): string | null {
    const { pkgRoot, namespaceKey, resolvedFacadePath } = opts;

    let currentDir = dirname(resolvedFacadePath);
    while (true) {
      // Case 1: bindings.json is directly in this directory (e.g. "<ns>/bindings.json").
      const direct = join(currentDir, "bindings.json");
      if (this.hasBindings(direct)) return direct;

      // Case 2: facade stub "<ns>.js" sits next to "<ns>/bindings.json".
      const sibling = join(currentDir, namespaceKey, "bindings.json");
      if (this.hasBindings(sibling)) return sibling;

      if (currentDir === pkgRoot) return null;

      const parent = dirname(currentDir);
      if (parent === currentDir) return null;
      currentDir = parent;
    }
  }

  private findBindingsPathLegacy(pkgRoot: string, subpath: string): string | null {
    // Strip .js extension from the full subpath and walk up segments until a directory
    // containing bindings.json is found under pkgRoot.
    const namespaceSubpath = subpath.endsWith(".js") ? subpath.slice(0, -3) : subpath;

    let current = namespaceSubpath;
    while (true) {
      const bindingsPath = join(pkgRoot, current, "bindings.json");
      if (this.hasBindings(bindingsPath)) return bindingsPath;

      // Walk up one path segment.
      const idx = Math.max(current.lastIndexOf("/"), current.lastIndexOf("\\"));
      if (idx <= 0) return null;
      current = current.slice(0, idx);
    }
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
      const here = fileURLToPath(import.meta.url);
      // <repoRoot>/packages/frontend/src/resolver/clr-bindings-resolver.ts
      const repoRoot = dirname(dirname(dirname(dirname(dirname(here)))));
      const siblingRoot = join(repoRoot, "..", pkgDirName);
      if (!existsSync(join(siblingRoot, "package.json"))) return null;
      return siblingRoot;
    };

    const direct = resolveViaRequire(this.require);
    if (direct) {
      this.pkgRootCache.set(packageName, direct);
      return direct;
    }

    if (packageName.startsWith("@tsonic/")) {
      const compilerDirect = resolveViaRequire(this.compilerRequire);
      if (compilerDirect) {
        this.pkgRootCache.set(packageName, compilerDirect);
        return compilerDirect;
      }
    }

    const fromPaths = resolveViaSearchPaths(this.require.resolve.paths(packageName));
    if (fromPaths) {
      this.pkgRootCache.set(packageName, fromPaths);
      return fromPaths;
    }

    if (packageName.startsWith("@tsonic/")) {
      const fromCompilerPaths = resolveViaSearchPaths(
        this.compilerRequire.resolve.paths(packageName)
      );
      if (fromCompilerPaths) {
        this.pkgRootCache.set(packageName, fromCompilerPaths);
        return fromCompilerPaths;
      }
    }

    const sibling = resolveFromSiblingCheckout();
    if (sibling) {
      this.pkgRootCache.set(packageName, sibling);
      return sibling;
    }

    this.pkgRootCache.set(packageName, null);
    return null;
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
