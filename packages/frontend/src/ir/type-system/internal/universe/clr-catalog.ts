/**
 * CLR Type Catalog Loader
 *
 * Loads CLR type metadata from tsbindgen <Namespace>/bindings.json files
 * into a queryable catalog structure.
 *
 * INVARIANT INV-CLR: All assembly types loaded here become part of the
 * unified type catalog. No parallel lookup paths allowed.
 *
 * The loader:
 * 1. Scans node_modules/@tsonic/* packages for metadata files
 * 2. Parses bindings.json for type definitions, members, signatures
 * 4. Converts to NominalEntry structures with proper IrType members
 */

import * as fs from "fs";
import * as path from "path";
import type {
  AssemblyTypeCatalog,
  TypeId,
  NominalEntry,
  MemberEntry,
  RawBindingsFile,
} from "./types.js";
import { convertRawType, enrichAssemblyEntriesFromTsBindgenDts } from "./clr-entry-converter.js";

// ═══════════════════════════════════════════════════════════════════════════
// BARREL RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export {
  parseClrTypeString,
  splitTypeArguments,
  dtsTypeNodeToIrType,
  irTypeToSignatureKey,
  makeMethodSignatureKey,
  INSTANCE_SUFFIX,
  VIEWS_PREFIX,
  VIEWS_SUFFIX,
  stripTsBindgenInstanceSuffix,
  stripTsBindgenViewsWrapper,
  getRightmostQualifiedNameText,
  getRightmostPropertyAccessText,
} from "./clr-type-parser.js";

export type { TsBindgenDtsTypeInfo } from "./clr-entry-converter.js";

export {
  extractHeritageFromTsBindgenDts,
  enrichAssemblyEntriesFromTsBindgenDts,
  parsePropertyType,
  parseFieldType,
  parseMethodSignature,
  convertRawType,
} from "./clr-entry-converter.js";

// ═══════════════════════════════════════════════════════════════════════════
// FILE DISCOVERY AND LOADING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Find all @tsonic packages in node_modules.
 */
const findTsonicPackages = (nodeModulesPath: string): string[] => {
  const tsonicDir = path.join(nodeModulesPath, "@tsonic");
  if (!fs.existsSync(tsonicDir)) {
    return [];
  }

  const packages: string[] = [];
  for (const entry of fs.readdirSync(tsonicDir, { withFileTypes: true })) {
    const fullPath = path.join(tsonicDir, entry.name);

    if (entry.isDirectory()) {
      packages.push(fullPath);
      continue;
    }

    // In multi-repo workspaces, @tsonic packages are often symlinked into node_modules.
    // Dirent reports these as symbolic links, so we must stat the target to detect
    // directory packages.
    if (entry.isSymbolicLink()) {
      try {
        if (fs.statSync(fullPath).isDirectory()) {
          packages.push(fullPath);
        }
      } catch {
        // Ignore broken links.
      }
    }
  }
  return packages;
};

/**
 * Find all bindings.json files in a package.
 */
const findBindingsFiles = (packagePath: string): string[] => {
  const bindingsFiles: string[] = [];

  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name === "bindings.json") {
        bindingsFiles.push(fullPath);
      }
    }
  };

  walk(packagePath);
  return bindingsFiles;
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN LOADER FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Load all assembly types from node_modules/@tsonic packages.
 *
 * @param nodeModulesPath - Path to node_modules directory
 * @returns AssemblyTypeCatalog with all loaded types
 */
export const loadClrCatalog = (
  nodeModulesPath: string,
  extraPackageRoots: readonly string[] = []
): AssemblyTypeCatalog => {
  const entries = new Map<string, NominalEntry>();
  const tsNameToTypeId = new Map<string, TypeId>();
  const clrNameToTypeId = new Map<string, TypeId>();
  const namespaceToTypeIds = new Map<string, TypeId[]>();
  const dtsFiles = new Set<string>();

  // Find all @tsonic packages
  const packageRoots = new Set<string>(findTsonicPackages(nodeModulesPath));
  for (const extra of extraPackageRoots) {
    packageRoots.add(extra);
  }

  for (const packagePath of Array.from(packageRoots).sort()) {
    // Find all bindings.json files
    const bindingsFiles = findBindingsFiles(packagePath);

    for (const bindingsPath of bindingsFiles) {
      try {
        const internalDtsPath = path.join(
          path.dirname(bindingsPath),
          "internal",
          "index.d.ts"
        );
        if (fs.existsSync(internalDtsPath)) {
          dtsFiles.add(internalDtsPath);
        }

        const content = fs.readFileSync(bindingsPath, "utf-8");
        const bindings: RawBindingsFile = JSON.parse(content);

        for (const rawType of bindings.types) {
          const entry = convertRawType(rawType, bindings.namespace);

          // Add to entries map
          entries.set(entry.typeId.stableId, entry);

          // Add to name lookup maps
          tsNameToTypeId.set(entry.typeId.tsName, entry.typeId);
          clrNameToTypeId.set(entry.typeId.clrName, entry.typeId);

          // Add to namespace map
          const nsTypes = namespaceToTypeIds.get(bindings.namespace) ?? [];
          nsTypes.push(entry.typeId);
          namespaceToTypeIds.set(bindings.namespace, nsTypes);
        }
      } catch (e) {
        // Log but continue - don't fail on malformed files
        console.warn(`Failed to load metadata from ${bindingsPath}:`, e);
      }
    }
  }

  // Enrich CLR catalog with heritage edges and type parameter names by parsing
  // tsbindgen internal `index.d.ts` files. This is required for deterministic
  // generic inference through inheritance (e.g., List<T> → IEnumerable<T>).
  enrichAssemblyEntriesFromTsBindgenDts(
    entries,
    tsNameToTypeId,
    Array.from(dtsFiles).sort()
  );

  return {
    entries,
    tsNameToTypeId,
    clrNameToTypeId,
    namespaceToTypeIds,
  };
};

/**
 * Load CLR catalog from a specific package (for testing).
 */
export const loadSinglePackageBindings = (
  bindingsPath: string
): AssemblyTypeCatalog => {
  const entries = new Map<string, NominalEntry>();
  const tsNameToTypeId = new Map<string, TypeId>();
  const clrNameToTypeId = new Map<string, TypeId>();
  const namespaceToTypeIds = new Map<string, TypeId[]>();
  const dtsPath = path.join(
    path.dirname(bindingsPath),
    "internal",
    "index.d.ts"
  );

  const content = fs.readFileSync(bindingsPath, "utf-8");
  const bindings: RawBindingsFile = JSON.parse(content);

  for (const rawType of bindings.types) {
    const entry = convertRawType(rawType, bindings.namespace);

    entries.set(entry.typeId.stableId, entry);
    tsNameToTypeId.set(entry.typeId.tsName, entry.typeId);
    clrNameToTypeId.set(entry.typeId.clrName, entry.typeId);

    const nsTypes = namespaceToTypeIds.get(bindings.namespace) ?? [];
    nsTypes.push(entry.typeId);
    namespaceToTypeIds.set(bindings.namespace, nsTypes);
  }

  if (fs.existsSync(dtsPath)) {
    enrichAssemblyEntriesFromTsBindgenDts(entries, tsNameToTypeId, [dtsPath]);
  }

  return {
    entries,
    tsNameToTypeId,
    clrNameToTypeId,
    namespaceToTypeIds,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// CATALOG QUERY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get a type entry by stableId.
 */
export const getTypeByStableId = (
  catalog: AssemblyTypeCatalog,
  stableId: string
): NominalEntry | undefined => {
  return catalog.entries.get(stableId);
};

/**
 * Get a type entry by TS name.
 */
export const getTypeByTsName = (
  catalog: AssemblyTypeCatalog,
  tsName: string
): NominalEntry | undefined => {
  const typeId = catalog.tsNameToTypeId.get(tsName);
  return typeId ? catalog.entries.get(typeId.stableId) : undefined;
};

/**
 * Get a type entry by CLR name.
 */
export const getTypeByClrName = (
  catalog: AssemblyTypeCatalog,
  clrName: string
): NominalEntry | undefined => {
  const typeId = catalog.clrNameToTypeId.get(clrName);
  return typeId ? catalog.entries.get(typeId.stableId) : undefined;
};

/**
 * Get a member from a type by TS name.
 */
export const getMemberByTsName = (
  catalog: AssemblyTypeCatalog,
  typeStableId: string,
  memberTsName: string
): MemberEntry | undefined => {
  const entry = catalog.entries.get(typeStableId);
  return entry?.members.get(memberTsName);
};
