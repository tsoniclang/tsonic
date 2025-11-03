/**
 * .NET metadata file loading
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  DotnetMetadataRegistry,
  DotnetMetadataFile,
} from "../dotnet-metadata.js";

/**
 * Recursively scan a directory for .d.ts files
 */
const scanForDeclarationFiles = (dir: string): readonly string[] => {
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
 * Load .NET metadata files from configured type roots
 * Looks for *.metadata.json files alongside .d.ts files
 */
export const loadDotnetMetadata = (
  typeRoots: readonly string[]
): DotnetMetadataRegistry => {
  const registry = new DotnetMetadataRegistry();

  // Scan all type roots for .d.ts files
  for (const typeRoot of typeRoots) {
    const absoluteRoot = path.resolve(typeRoot);
    const declFiles = scanForDeclarationFiles(absoluteRoot);

    for (const declPath of declFiles) {
      // Look for corresponding .metadata.json file
      const metadataPath = declPath.replace(/\.d\.ts$/, ".metadata.json");

      try {
        if (fs.existsSync(metadataPath)) {
          const content = fs.readFileSync(metadataPath, "utf-8");
          const metadataFile = JSON.parse(content) as DotnetMetadataFile;
          registry.loadMetadataFile(metadataPath, metadataFile);
        }
      } catch (err) {
        // Silently skip files that can't be read or parsed
        // In production, we might want to emit a warning diagnostic
        console.warn(`Failed to load metadata from ${metadataPath}:`, err);
      }
    }
  }

  return registry;
};
