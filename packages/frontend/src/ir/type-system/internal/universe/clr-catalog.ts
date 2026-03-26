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
 * 1. Loads only explicitly participating CLR package roots
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
  RawBindingsPayload,
} from "./types.js";
import { extractRawDotnetBindingsPayload } from "../../../../program/dotnet-binding-payload.js";
import {
  convertRawType,
  enrichAssemblyEntriesFromTsBindgenDts,
} from "./clr-entry-converter.js";

const isSourcePackageRoot = (packagePath: string): boolean => {
  const manifestPath = path.join(packagePath, "tsonic.package.json");
  if (!fs.existsSync(manifestPath)) {
    return false;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
      readonly kind?: unknown;
    };
    return parsed.kind === "tsonic-source-package";
  } catch {
    return false;
  }
};

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
 * Find all bindings.json files in an explicit CLR package root.
 */
const findBindingsFiles = (packagePath: string): string[] => {
  const bindingsFiles = new Set<string>();
  const visitedDirs = new Set<string>();

  const walk = (dir: string) => {
    const resolvedDir = resolveExistingDirectory(dir);
    if (!resolvedDir || visitedDirs.has(resolvedDir)) {
      return;
    }
    visitedDirs.add(resolvedDir);

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
    } catch (error) {
      if (isIgnorableDirReadError(error)) {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const fullPath = path.join(resolvedDir, entry.name);
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        walk(fullPath);
      }

      if (entry.name !== "bindings.json") {
        continue;
      }

      const resolvedFile = resolveExistingFile(fullPath);
      if (resolvedFile) {
        bindingsFiles.add(resolvedFile);
      }
    }
  };

  walk(packagePath);
  return Array.from(bindingsFiles).sort();
};

const isIgnorableDirReadError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const err = error as Error & { code?: string };
  return err.code === "EACCES" || err.code === "EPERM";
};

const resolveExistingDirectory = (
  candidatePath: string
): string | undefined => {
  try {
    const resolved = fs.realpathSync.native(candidatePath);
    return fs.statSync(resolved).isDirectory() ? resolved : undefined;
  } catch {
    return undefined;
  }
};

const resolveExistingFile = (candidatePath: string): string | undefined => {
  try {
    const resolved = fs.realpathSync.native(candidatePath);
    return fs.statSync(resolved).isFile() ? resolved : undefined;
  } catch {
    return undefined;
  }
};

const resolveExistingCompanionDts = (
  bindingsPath: string
): string | undefined => {
  return resolveExistingFile(
    path.join(path.dirname(bindingsPath), "internal", "index.d.ts")
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN LOADER FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Load all assembly types from explicitly participating CLR packages.
 *
 * @param _nodeModulesPath - Unused legacy slot preserved for call-site stability
 * until callers are fully migrated to the explicit-roots-only model.
 * @param extraPackageRoots - Explicit CLR package roots participating in this build
 * @returns AssemblyTypeCatalog with all loaded types
 */
export const loadClrCatalog = (
  _nodeModulesPath: string,
  extraPackageRoots: readonly string[] = []
): AssemblyTypeCatalog => {
  const entries = new Map<string, NominalEntry>();
  const tsNameToTypeId = new Map<string, TypeId>();
  const clrNameToTypeId = new Map<string, TypeId>();
  const namespaceToTypeIds = new Map<string, TypeId[]>();
  const dtsFiles = new Set<string>();

  const packageRoots = new Set<string>();
  for (const extra of extraPackageRoots) {
    const resolvedExtra = resolveExistingDirectory(extra);
    if (resolvedExtra) {
      packageRoots.add(resolvedExtra);
    }
  }

  for (const packagePath of Array.from(packageRoots).sort()) {
    if (isSourcePackageRoot(packagePath)) {
      continue;
    }

    // Find all bindings.json files
    const bindingsFiles = findBindingsFiles(packagePath);

    for (const bindingsPath of bindingsFiles) {
      try {
        const internalDtsPath = resolveExistingCompanionDts(bindingsPath);
        if (internalDtsPath) {
          dtsFiles.add(internalDtsPath);
        }

        const content = fs.readFileSync(bindingsPath, "utf-8");
        const parsed = JSON.parse(content) as unknown;
        const bindings = extractRawDotnetBindingsPayload(parsed) as
          | RawBindingsPayload
          | undefined;
        if (!bindings) {
          continue;
        }

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
  const parsed = JSON.parse(content) as unknown;
  const bindings = extractRawDotnetBindingsPayload(parsed) as
    | RawBindingsPayload
    | undefined;
  if (!bindings) {
    throw new Error(
      `Expected CLR bindings with 'namespace' and either 'types' or 'dotnet.types' at ${bindingsPath}`
    );
  }

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
