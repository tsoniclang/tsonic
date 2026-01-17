/**
 * .NET semantic registry loading
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  DotnetMetadataRegistry,
  TsbindgenBindingsFile,
} from "../dotnet-metadata.js";

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
      results.push(...scanForBindingsFiles(fullPath));
    } else if (entry.name === "bindings.json") {
      results.push(fullPath);
    }
  }

  return results;
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

  // Scan all type roots for bindings.json manifests
  for (const typeRoot of typeRoots) {
    const absoluteRoot = path.resolve(typeRoot);
    const bindingsFiles = scanForBindingsFiles(absoluteRoot);

    for (const bindingsPath of bindingsFiles) {
      try {
        const content = fs.readFileSync(bindingsPath, "utf-8");
        const bindingsFile = JSON.parse(content) as TsbindgenBindingsFile;
        registry.loadBindingsFile(bindingsPath, bindingsFile);
      } catch (err) {
        // Silently skip files that can't be read or parsed
        // In production, we might want to emit a warning diagnostic
        console.warn(`Failed to load bindings from ${bindingsPath}:`, err);
      }
    }
  }

  return registry;
};
