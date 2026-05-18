/**
 * External Bindings Resolve Logic
 *
 * Core resolution logic for external namespace imports: specifier parsing,
 * namespace key extraction, facade path resolution, and bindings.json
 * discovery.
 */

import { dirname, join } from "node:path";
import { createRequire } from "node:module";

import type {
  ResolvedExternalImport,
  ParsedSpecifier,
} from "./external-bindings-resolver.js";
import {
  resolvePkgRoot,
  hasBindings,
  extractNamespace,
  extractOwnerIdentity,
} from "./external-bindings-package-resolution.js";

/**
 * Resolver for external namespace imports
 *
 * An import is a external namespace import iff:
 * - It's a package import with a subpath (e.g., @scope/pkg/Namespace)
 * - The package contains bindings.json in that subpath directory
 *
 * This works for any bindings provider package.
 */
export class ExternalBindingsResolver {
  // Cache: packageName -> packageRoot (or null if not found)
  private readonly pkgRootCache = new Map<string, string | null>();

  // Cache: absolute bindingsPath -> exists
  private readonly bindingsExistsCache = new Map<string, boolean>();

  // Cache: absolute bindingsPath -> namespace (extracted from bindings.json)
  private readonly namespaceCache = new Map<string, string | null>();

  // Cache: absolute bindingsPath -> owner identity (extracted from bindings.json types)
  private readonly ownerIdentityCache = new Map<string, string | null>();

  // Cache: module specifier -> resolved absolute path (or null if not found)
  private readonly resolvedPathCache = new Map<string, string | null>();

  // require function for Node resolution from the base directory
  private readonly require: ReturnType<typeof createRequire>;

  constructor(baseDir: string) {
    // Create a require function that resolves relative to baseDir
    this.require = createRequire(join(baseDir, "package.json"));
  }

  /**
   * Resolve an import specifier to determine if it's a external namespace import
   */
  resolve(moduleSpecifier: string): ResolvedExternalImport {
    // Skip local imports
    if (moduleSpecifier.startsWith(".") || moduleSpecifier.startsWith("/")) {
      return { kind: "notExternalSurface" };
    }

    // Parse the specifier into package name and subpath
    const parsed = this.parseModuleSpecifier(moduleSpecifier);
    if (!parsed) {
      return { kind: "notExternalSurface" };
    }

    const { packageName, subpath } = parsed;

    // No subpath means it's not a namespace import (e.g., just "@scope/pkg")
    if (!subpath) {
      return { kind: "notExternalSurface" };
    }

    // Extract the namespace key from the import subpath.
    const namespaceKey = this.extractNamespaceKey(subpath);
    if (namespaceKey === null) return { kind: "notExternalSurface" };

    // Prefer exports-aware resolution
    const facadeSpecifier =
      namespaceKey === ""
        ? `${packageName}/index.js`
        : `${packageName}/${namespaceKey}.js`;
    const resolvedFacadePath = this.resolveModulePath(
      packageName,
      facadeSpecifier
    );

    // Resolve package root using Node resolution (for bounding searches).
    const pkgRoot = resolvePkgRoot(
      packageName,
      this.pkgRootCache,
      this.require
    );
    if (!pkgRoot) {
      return { kind: "notExternalSurface" };
    }

    const bindingsPath =
      resolvedFacadePath &&
      this.findBindingsPathFromFacade({
        pkgRoot,
        namespaceKey,
        resolvedFacadePath,
      });

    if (!bindingsPath) {
      return { kind: "notExternalSurface" };
    }

    // Extract namespace from bindings.json (tsbindgen format)
    const resolvedNamespace = extractNamespace(
      bindingsPath,
      this.namespaceCache
    );
    if (!resolvedNamespace) {
      return { kind: "notExternalSurface" };
    }

    // Extract owner identity from bindings.json types
    const ownerIdentity = extractOwnerIdentity(bindingsPath, this.ownerIdentityCache);

    return {
      kind: "externalSurface",
      packageName,
      resolvedNamespace,
      bindingsPath,
      ownerIdentity,
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
    const firstSeg = (
      firstSep === -1 ? subpath : subpath.slice(0, firstSep)
    ).trim();
    if (!firstSeg) return null;

    const normalized = firstSeg.endsWith(".js")
      ? firstSeg.slice(0, -3)
      : firstSeg;
    return normalized === "index" ? "" : normalized;
  }

  private resolveModulePath(
    _packageName: string,
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
      const siblingNamespace = namespaceKey === "" ? "index" : namespaceKey;
      const sibling = join(currentDir, siblingNamespace, "bindings.json");
      if (
        namespaceKey === ""
          ? hasBindings(sibling, this.bindingsExistsCache)
          : this.hasBindingsForNamespace(sibling, namespaceKey)
      ) {
        return sibling;
      }

      const direct = join(currentDir, "bindings.json");
      if (
        namespaceKey === ""
          ? hasBindings(direct, this.bindingsExistsCache)
          : this.hasBindingsForNamespace(direct, namespaceKey)
      ) {
        return direct;
      }

      if (currentDir === pkgRoot) return null;

      const parent = dirname(currentDir);
      if (parent === currentDir) return null;
      currentDir = parent;
    }
  }

  private parseModuleSpecifier(spec: string): ParsedSpecifier | null {
    if (spec.startsWith("@")) {
      const match = spec.match(/^(@[^/]+\/[^/]+)(?:\/(.+))?$/);
      if (!match) return null;
      const packageName = match[1];
      const subpath = match[2];
      if (!packageName || !subpath) return null;
      return { packageName, subpath };
    } else {
      const slashIdx = spec.indexOf("/");
      if (slashIdx === -1) return null;
      return {
        packageName: spec.slice(0, slashIdx),
        subpath: spec.slice(slashIdx + 1),
      };
    }
  }

  private hasBindingsForNamespace(
    bindingsPath: string,
    expectedNamespace: string
  ): boolean {
    if (!hasBindings(bindingsPath, this.bindingsExistsCache)) return false;
    const resolvedNamespace = extractNamespace(
      bindingsPath,
      this.namespaceCache
    );
    return resolvedNamespace === expectedNamespace;
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
