/**
 * Binding Loader - package discovery + loading functions
 *
 * Discovers and loads binding manifest files from @tsonic packages
 * and other configured type roots.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { BindingFile } from "./binding-types.js";
import { validateBindingFile } from "./binding-types.js";
import { BindingRegistry } from "./binding-registry.js";

/**
 * Recursively scan a directory for .d.ts files
 * Reuses the same helper as metadata loading
 */
export const scanForDeclarationFiles = (dir: string): readonly string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanForDeclarationFiles(fullPath));
    } else if (entry.name.endsWith(".d.ts")) {
      results.push(fullPath);
    }
  }

  return results;
};

/**
 * Load bindings from a package directory and recursively from its @tsonic/* dependencies.
 *
 * This supports the common "namespace facade" layout:
 * - `System.d.ts` (or `index.d.ts`) at the package root
 * - `System/bindings.json` (or `index/bindings.json`) next to the namespace's `internal/index.d.ts`
 *
 * Some packages may also provide a root-level `bindings.json` (simple/global bindings).
 */
const loadBindingsFromPackage = (
  registry: BindingRegistry,
  packageRoot: string,
  visited: Set<string>
): void => {
  // Avoid cycles
  const absoluteRoot = path.resolve(packageRoot);
  if (visited.has(absoluteRoot)) {
    return;
  }
  visited.add(absoluteRoot);

  // Skip if directory doesn't exist
  if (!fs.existsSync(absoluteRoot)) {
    return;
  }

  const rootEntries = fs.readdirSync(absoluteRoot, { withFileTypes: true });

  // Strategy 1: root-level bindings.json (simple/global bindings)
  const rootBindingsPath = path.join(absoluteRoot, "bindings.json");
  loadBindingsFromPath(registry, rootBindingsPath);

  // Strategy 2: Namespace/bindings.json for each Namespace.d.ts facade
  const facadeFiles = rootEntries
    .filter((e) => e.isFile() && e.name.endsWith(".d.ts"))
    .map((e) => e.name);

  for (const facadeFile of facadeFiles) {
    // e.g., "System.d.ts" → "System"
    const namespaceName = facadeFile.slice(0, -".d.ts".length);
    const namespaceDir = path.join(absoluteRoot, namespaceName);
    const bindingsPath = path.join(namespaceDir, "bindings.json");

    if (fs.existsSync(bindingsPath)) {
      loadBindingsFromPath(registry, bindingsPath);
    }
  }

  // Strategy 3: Recursively load bindings from @tsonic/* dependencies
  // This is crucial for packages like @tsonic/globals that depend on @tsonic/dotnet
  const packageJsonPath = path.join(absoluteRoot, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const deps = packageJson.dependencies || {};

      for (const depName of Object.keys(deps)) {
        // Only follow @tsonic/* dependencies to load their bindings
        if (depName.startsWith("@tsonic/")) {
          // Find the dependency in node_modules
          // Try sibling node_modules first (hoisted), then nested
          const nodeModulesDir = path.dirname(path.dirname(absoluteRoot));
          const hoistedPath = path.join(nodeModulesDir, depName);
          const nestedPath = path.join(absoluteRoot, "node_modules", depName);

          if (fs.existsSync(hoistedPath)) {
            loadBindingsFromPackage(registry, hoistedPath, visited);
          } else if (fs.existsSync(nestedPath)) {
            loadBindingsFromPackage(registry, nestedPath, visited);
          }
        }
      }
    } catch {
      // Ignore JSON parse errors in package.json
    }
  }
};

/**
 * Load binding manifests from configured type roots.
 *
 * Conventions:
 * - Root-level `bindings.json` (simple/global bindings)
 * - `Namespace.d.ts` + `Namespace/bindings.json` (namespace facade)
 *
 * Also recursively loads bindings from @tsonic/* dependencies of typeRoot packages.
 */
export const loadBindings = (typeRoots: readonly string[]): BindingRegistry => {
  const registry = new BindingRegistry();
  const visited = new Set<string>();

  for (const typeRoot of typeRoots) {
    loadBindingsFromPackage(registry, typeRoot, visited);
  }

  return registry;
};

/**
 * Load bindings from a specific file path into an existing registry.
 * Validates the file format and logs a warning if invalid.
 */
export const loadBindingsFromPath = (
  registry: BindingRegistry,
  bindingsPath: string
): void => {
  try {
    if (fs.existsSync(bindingsPath)) {
      const content = fs.readFileSync(bindingsPath, "utf-8");
      const parsed = JSON.parse(content) as unknown;

      // Validate the parsed structure
      const validationError = validateBindingFile(parsed, bindingsPath);
      if (validationError) {
        console.warn(`Invalid bindings file: ${validationError}`);
        return;
      }

      registry.addBindings(bindingsPath, parsed as BindingFile);
    }
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.warn(
        `Failed to parse bindings from ${bindingsPath}: Invalid JSON - ${err.message}`
      );
    } else {
      console.warn(`Failed to load bindings from ${bindingsPath}:`, err);
    }
  }
};

/**
 * Load all CLR bindings discovered by the resolver.
 * This should be called AFTER createProgram but BEFORE IR building
 * to ensure all bindings are available during IR construction.
 *
 * Note: The ClrBindingsResolver tracks discovered binding paths via caching,
 * so this loads bindings for any imports that were already resolved.
 */
export const loadAllDiscoveredBindings = (
  registry: BindingRegistry,
  discoveredPaths: ReadonlySet<string>
): void => {
  for (const bindingsPath of discoveredPaths) {
    loadBindingsFromPath(registry, bindingsPath);
  }
};
