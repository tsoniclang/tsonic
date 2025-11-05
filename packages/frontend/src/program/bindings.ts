/**
 * Binding manifest loading - maps JS/TS names to CLR types/members
 * See spec/bindings.md for full manifest format
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Member binding (method/property level)
 */
export type MemberBinding = {
  readonly kind: "method" | "property";
  readonly signature?: string; // Optional TS signature for diagnostics
  readonly name: string; // CLR member name (e.g., "SelectMany")
  readonly alias: string; // TS identifier (e.g., "selectMany")
  readonly binding: {
    readonly assembly: string;
    readonly type: string; // Full CLR type (e.g., "System.Linq.Enumerable")
    readonly member: string; // CLR member name
  };
};

/**
 * Type binding (class/interface/struct/enum level)
 */
export type TypeBinding = {
  readonly name: string; // CLR type name (e.g., "Enumerable")
  readonly alias: string; // TS identifier (e.g., "enumerable")
  readonly kind: "class" | "interface" | "struct" | "enum";
  readonly members: readonly MemberBinding[];
};

/**
 * Namespace binding
 */
export type NamespaceBinding = {
  readonly name: string; // CLR namespace (e.g., "System.Linq")
  readonly alias: string; // TS identifier (e.g., "systemLinq")
  readonly types: readonly TypeBinding[];
};

/**
 * Full binding manifest structure (new format from bindings.md)
 */
export type FullBindingManifest = {
  readonly assembly: string;
  readonly namespaces: readonly NamespaceBinding[];
};

/**
 * Simple binding entry (legacy format for backwards compatibility)
 * Maps simple global/module identifiers to CLR types
 */
export type SimpleBindingDescriptor = {
  readonly kind: "global" | "module";
  readonly assembly: string;
  readonly type: string;
  readonly csharpName?: string; // Optional: rename identifier in generated C#
};

/**
 * Legacy binding file structure (backwards compatible)
 */
export type LegacyBindingFile = {
  readonly bindings: Readonly<Record<string, SimpleBindingDescriptor>>;
};

/**
 * Union type for both binding formats
 */
export type BindingFile = FullBindingManifest | LegacyBindingFile;

/**
 * Type guard to check if a manifest is the full format
 */
const isFullBindingManifest = (
  manifest: BindingFile
): manifest is FullBindingManifest => {
  return "assembly" in manifest && "namespaces" in manifest;
};

/**
 * Registry of all loaded bindings
 * Supports both legacy (simple global/module) and new (hierarchical namespace/type/member) formats
 */
export class BindingRegistry {
  // Legacy format: simple global/module bindings
  private readonly simpleBindings = new Map<string, SimpleBindingDescriptor>();

  // New format: hierarchical bindings
  private readonly namespaces = new Map<string, NamespaceBinding>();
  private readonly types = new Map<string, TypeBinding>(); // Flat lookup by TS name
  private readonly members = new Map<string, MemberBinding>(); // Flat lookup by "type.member"

  /**
   * Load a binding manifest file and add its bindings to the registry
   * Supports both legacy and new formats
   */
  addBindings(_filePath: string, manifest: BindingFile): void {
    if (isFullBindingManifest(manifest)) {
      // New format: hierarchical namespace/type/member structure
      // Index by alias (TS identifier) for quick lookup
      for (const ns of manifest.namespaces) {
        this.namespaces.set(ns.alias, ns);

        // Index types for quick lookup by TS alias
        for (const type of ns.types) {
          this.types.set(type.alias, type);

          // Index members for quick lookup (keyed by "typeAlias.memberAlias")
          for (const member of type.members) {
            const key = `${type.alias}.${member.alias}`;
            this.members.set(key, member);
          }
        }
      }
    } else {
      // Legacy format: simple global/module bindings
      for (const [name, descriptor] of Object.entries(manifest.bindings)) {
        this.simpleBindings.set(name, descriptor);
      }
    }
  }

  /**
   * Look up a simple global/module binding (legacy format)
   */
  getBinding(name: string): SimpleBindingDescriptor | undefined {
    return this.simpleBindings.get(name);
  }

  /**
   * Look up a namespace binding by TS alias
   */
  getNamespace(tsAlias: string): NamespaceBinding | undefined {
    return this.namespaces.get(tsAlias);
  }

  /**
   * Look up a type binding by TS alias
   */
  getType(tsAlias: string): TypeBinding | undefined {
    return this.types.get(tsAlias);
  }

  /**
   * Look up a member binding by TS type alias and member alias
   */
  getMember(typeAlias: string, memberAlias: string): MemberBinding | undefined {
    const key = `${typeAlias}.${memberAlias}`;
    return this.members.get(key);
  }

  /**
   * Get all loaded simple bindings (legacy)
   */
  getAllBindings(): readonly [string, SimpleBindingDescriptor][] {
    return Array.from(this.simpleBindings.entries());
  }

  /**
   * Get all loaded namespaces
   */
  getAllNamespaces(): readonly NamespaceBinding[] {
    return Array.from(this.namespaces.values());
  }

  /**
   * Clear all loaded bindings
   */
  clear(): void {
    this.simpleBindings.clear();
    this.namespaces.clear();
    this.types.clear();
    this.members.clear();
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
