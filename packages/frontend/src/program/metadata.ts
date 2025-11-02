/**
 * .NET metadata file loading
 */

import * as ts from "typescript";
import * as fs from "node:fs";
import {
  DotnetMetadataRegistry,
  DotnetMetadataFile,
} from "../dotnet-metadata.js";

/**
 * Load .NET metadata files from packages/runtime/lib/
 * Looks for *.metadata.json files alongside .d.ts files
 */
export const loadDotnetMetadata = (
  program: ts.Program
): DotnetMetadataRegistry => {
  const registry = new DotnetMetadataRegistry();

  // Get all declaration files from the program
  const declarationFiles = program
    .getSourceFiles()
    .filter((sf) => sf.isDeclarationFile);

  for (const declFile of declarationFiles) {
    const declPath = declFile.fileName;

    // Check if this is a .NET declaration file
    // Assuming .NET declarations are in packages/runtime/lib/
    if (!declPath.includes("packages/runtime/lib")) {
      continue;
    }

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

  return registry;
};
