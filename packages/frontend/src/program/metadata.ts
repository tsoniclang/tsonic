/**
 * .NET semantic registry loading
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  DotnetMetadataRegistry,
  TsbindgenBindingsFile,
} from "../dotnet-metadata.js";
import { resolveDependencyPackageRoot } from "./package-roots.js";

/**
 * Recursively scan a directory for tsbindgen `<Namespace>/bindings.json` files.
 */
const scanForBindingsFiles = (dir: string): readonly string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }
      results.push(...scanForBindingsFiles(fullPath));
    } else if (entry.name === "bindings.json") {
      results.push(fullPath);
    }
  }

  return results;
};

const loadMetadataFromPackage = (
  registry: DotnetMetadataRegistry,
  packageRoot: string,
  visited: Set<string>,
  forceDependencyTraversal = false
): void => {
  const absoluteRoot = path.resolve(packageRoot);
  if (visited.has(absoluteRoot)) {
    return;
  }
  visited.add(absoluteRoot);

  if (!fs.existsSync(absoluteRoot)) {
    return;
  }

  const bindingsFiles = scanForBindingsFiles(absoluteRoot);
  let discoveredClrBindingsInPackage = false;

  for (const bindingsPath of bindingsFiles) {
    try {
      const content = fs.readFileSync(bindingsPath, "utf-8");
      const parsed = JSON.parse(content) as unknown;
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof (parsed as { readonly namespace?: unknown }).namespace ===
          "string" &&
        Array.isArray((parsed as { readonly types?: unknown }).types)
      ) {
        discoveredClrBindingsInPackage = true;
        registry.loadBindingsFile(
          bindingsPath,
          parsed as TsbindgenBindingsFile
        );
      }
    } catch (err) {
      console.warn(`Failed to load bindings from ${bindingsPath}:`, err);
    }
  }

  const hasBindingsManifest = fs.existsSync(
    path.join(absoluteRoot, "tsonic.bindings.json")
  );
  const hasSurfaceManifest = fs.existsSync(
    path.join(absoluteRoot, "tsonic.surface.json")
  );
  const shouldTraverseDependencies =
    forceDependencyTraversal ||
    discoveredClrBindingsInPackage ||
    hasBindingsManifest ||
    hasSurfaceManifest;

  const packageJsonPath = path.join(absoluteRoot, "package.json");
  if (!shouldTraverseDependencies || !fs.existsSync(packageJsonPath)) {
    return;
  }

  try {
    const packageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, "utf-8")
    ) as {
      readonly dependencies?: Record<string, unknown>;
      readonly optionalDependencies?: Record<string, unknown>;
      readonly peerDependencies?: Record<string, unknown>;
    };
    const dependencyNames = new Set<string>();
    const dependencyBuckets = [
      packageJson.dependencies,
      packageJson.optionalDependencies,
      packageJson.peerDependencies,
    ];

    for (const bucket of dependencyBuckets) {
      if (
        bucket !== null &&
        typeof bucket === "object" &&
        !Array.isArray(bucket)
      ) {
        for (const depName of Object.keys(bucket)) {
          dependencyNames.add(depName);
        }
      }
    }

    for (const depName of dependencyNames) {
      const dependencyRoot = resolveDependencyPackageRoot(
        absoluteRoot,
        depName
      );
      if (dependencyRoot) {
        loadMetadataFromPackage(registry, dependencyRoot, visited, false);
      }
    }
  } catch {
    // Ignore unreadable or invalid package manifests.
  }
};

/**
 * Load .NET semantic info from configured type roots.
 *
 * tsbindgen emits a single manifest per namespace: `<Namespace>/bindings.json`.
 * This loader scans the configured type roots and loads all discovered manifests.
 */
export const loadDotnetMetadata = (
  typeRoots: readonly string[]
): DotnetMetadataRegistry => {
  const registry = new DotnetMetadataRegistry();
  const visited = new Set<string>();

  for (const typeRoot of typeRoots) {
    loadMetadataFromPackage(registry, typeRoot, visited, true);
  }

  return registry;
};
