/**
 * Binding manifest loading - maps JS globals/modules to CLR types
 * See spec/14-dotnet-declarations.md for manifest format
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Single binding entry mapping a JS identifier to a CLR type
 */
export type BindingDescriptor = {
  readonly kind: "global" | "module";
  readonly assembly: string;
  readonly type: string;
  readonly csharpName?: string; // Optional: rename identifier in generated C#
};

/**
 * Complete binding manifest file structure
 */
export type BindingFile = {
  readonly bindings: Readonly<Record<string, BindingDescriptor>>;
};

/**
 * Registry of all loaded bindings
 * Maps JS identifiers (console, Math, fs, path, etc.) to CLR types
 */
export class BindingRegistry {
  private readonly bindings = new Map<string, BindingDescriptor>();

  /**
   * Load a binding manifest file and add its bindings to the registry
   */
  addBindings(_filePath: string, manifest: BindingFile): void {
    for (const [name, descriptor] of Object.entries(manifest.bindings)) {
      this.bindings.set(name, descriptor);
    }
  }

  /**
   * Look up a binding by name (e.g., "console", "fs")
   */
  getBinding(name: string): BindingDescriptor | undefined {
    return this.bindings.get(name);
  }

  /**
   * Get all loaded bindings
   */
  getAllBindings(): readonly [string, BindingDescriptor][] {
    return Array.from(this.bindings.entries());
  }

  /**
   * Clear all loaded bindings
   */
  clear(): void {
    this.bindings.clear();
  }
}

/**
 * Recursively scan a directory for .d.ts files
 * Reuses the same helper as metadata loading
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
 * Load binding manifests from configured type roots
 * Looks for *.bindings.json files alongside .d.ts files OR directly in typeRoot
 */
export const loadBindings = (typeRoots: readonly string[]): BindingRegistry => {
  const registry = new BindingRegistry();

  for (const typeRoot of typeRoots) {
    const absoluteRoot = path.resolve(typeRoot);

    // Skip if directory doesn't exist
    if (!fs.existsSync(absoluteRoot)) {
      continue;
    }

    // Strategy 1: Look for manifest in the typeRoot itself
    const rootManifests = fs
      .readdirSync(absoluteRoot)
      .filter((f) => f.endsWith(".bindings.json"))
      .map((f) => path.join(absoluteRoot, f));

    for (const manifestPath of rootManifests) {
      try {
        const content = fs.readFileSync(manifestPath, "utf-8");
        const manifest = JSON.parse(content) as BindingFile;
        registry.addBindings(manifestPath, manifest);
      } catch (err) {
        console.warn(`Failed to load bindings from ${manifestPath}:`, err);
      }
    }

    // Strategy 2: Look for *.bindings.json next to each .d.ts file
    const declFiles = scanForDeclarationFiles(absoluteRoot);
    for (const declPath of declFiles) {
      const manifestPath = declPath.replace(/\.d\.ts$/, ".bindings.json");

      try {
        if (fs.existsSync(manifestPath)) {
          const content = fs.readFileSync(manifestPath, "utf-8");
          const manifest = JSON.parse(content) as BindingFile;
          registry.addBindings(manifestPath, manifest);
        }
      } catch (err) {
        console.warn(`Failed to load bindings from ${manifestPath}:`, err);
      }
    }
  }

  return registry;
};
