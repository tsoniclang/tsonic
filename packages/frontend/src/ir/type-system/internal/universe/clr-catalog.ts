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
import { resolveDependencyPackageRoot } from "../../../../program/package-roots.js";
import type { IrType } from "../../../types/index.js";
import type {
  AssemblyTypeCatalog,
  TypeId,
  NominalEntry,
  MemberEntry,
  RawBindingsPayload,
} from "./types.js";
import { makeTypeId } from "./types.js";
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
  makeMethodOverloadKey,
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

const resolveExistingCompanionDtsFiles = (
  bindingsPath: string
): readonly string[] => {
  const namespaceDir = path.dirname(bindingsPath);
  const namespaceName = path.basename(namespaceDir);
  const packageRoot = path.dirname(namespaceDir);
  const candidates = [
    path.join(packageRoot, `${namespaceName}.d.ts`),
    path.join(namespaceDir, "internal", "index.d.ts"),
  ];

  const resolvedFiles: string[] = [];
  for (const candidate of candidates) {
    const resolved = resolveExistingFile(candidate);
    if (resolved && !resolvedFiles.includes(resolved)) {
      resolvedFiles.push(resolved);
    }
  }

  return resolvedFiles;
};

// ═══════════════════════════════════════════════════════════════════════════
// CORE CLR CARRIERS
// ═══════════════════════════════════════════════════════════════════════════

const CORELIB_ASSEMBLY = "System.Private.CoreLib";

const coreTypeId = (clrName: string, tsName: string): TypeId =>
  makeTypeId(`${CORELIB_ASSEMBLY}:${clrName}`, clrName, CORELIB_ASSEMBLY, tsName);

const coreProperty = (
  owner: TypeId,
  name: string,
  type: IrType,
  readonly: boolean
): MemberEntry => ({
  tsName: name,
  clrName: name,
  memberKind: "property",
  type,
  isStatic: false,
  isReadonly: readonly,
  isAbstract: false,
  isVirtual: false,
  isOverride: false,
  isIndexer: false,
  hasGetter: true,
  hasSetter: !readonly,
  stableId: `${owner.stableId}::${name}`,
});

const createCoreClrCarrierEntries = (): readonly NominalEntry[] => {
  const systemArray = coreTypeId("System.Array", "Array");
  const intType: IrType = {
    kind: "primitiveType",
    name: "int",
  };
  const booleanType: IrType = {
    kind: "primitiveType",
    name: "boolean",
  };
  const objectType: IrType = {
    kind: "referenceType",
    name: "Object",
    resolvedClrType: "System.Object",
  };

  return [
    {
      typeId: systemArray,
      kind: "class",
      typeParameters: [],
      heritage: [],
      members: new Map([
        ["Length", coreProperty(systemArray, "Length", intType, true)],
        ["Rank", coreProperty(systemArray, "Rank", intType, true)],
        ["IsFixedSize", coreProperty(systemArray, "IsFixedSize", booleanType, true)],
        ["IsReadOnly", coreProperty(systemArray, "IsReadOnly", booleanType, true)],
        [
          "IsSynchronized",
          coreProperty(systemArray, "IsSynchronized", booleanType, true),
        ],
        ["SyncRoot", coreProperty(systemArray, "SyncRoot", objectType, true)],
      ]),
      origin: "assembly",
      accessibility: "public",
      isAbstract: true,
      isSealed: false,
      isStatic: false,
    },
  ];
};

const addCoreClrCarrierEntries = (
  entries: Map<string, NominalEntry>,
  tsNameToTypeId: Map<string, TypeId>,
  clrNameToTypeId: Map<string, TypeId>,
  namespaceToTypeIds: Map<string, TypeId[]>
): void => {
  for (const entry of createCoreClrCarrierEntries()) {
    if (entries.has(entry.typeId.stableId)) {
      continue;
    }

    entries.set(entry.typeId.stableId, entry);
    tsNameToTypeId.set(entry.typeId.tsName, entry.typeId);
    clrNameToTypeId.set(entry.typeId.clrName, entry.typeId);

    const namespaceTypes = namespaceToTypeIds.get("System") ?? [];
    namespaceTypes.push(entry.typeId);
    namespaceToTypeIds.set("System", namespaceTypes);
  }
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
  const visitedPackageRoots = new Set<string>();

  const visitPackageRoot = (
    packageRoot: string,
    forceDependencyTraversal: boolean
  ): void => {
    const resolvedRoot = resolveExistingDirectory(packageRoot);
    if (!resolvedRoot || visitedPackageRoots.has(resolvedRoot)) {
      return;
    }
    visitedPackageRoots.add(resolvedRoot);

    const sourcePackageRoot = isSourcePackageRoot(resolvedRoot);
    if (!sourcePackageRoot) {
      packageRoots.add(resolvedRoot);
    }

    const hasBindingsManifest =
      !sourcePackageRoot &&
      fs.existsSync(path.join(resolvedRoot, "tsonic.bindings.json"));
    const hasSurfaceManifest = fs.existsSync(
      path.join(resolvedRoot, "tsonic.surface.json")
    );
    const discoveredClrBindingsInPackage =
      !sourcePackageRoot && findBindingsFiles(resolvedRoot).length > 0;
    const shouldTraverseDependencies =
      forceDependencyTraversal ||
      sourcePackageRoot ||
      hasBindingsManifest ||
      hasSurfaceManifest ||
      discoveredClrBindingsInPackage;

    if (!shouldTraverseDependencies) {
      return;
    }

    const packageJsonPath = path.join(resolvedRoot, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
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
          resolvedRoot,
          depName
        );
        if (dependencyRoot) {
          visitPackageRoot(dependencyRoot, false);
        }
      }
    } catch {
      // Ignore unreadable or invalid package manifests.
    }
  };

  for (const extra of extraPackageRoots) {
    visitPackageRoot(extra, true);
  }

  for (const packagePath of Array.from(packageRoots).sort()) {
    if (isSourcePackageRoot(packagePath)) {
      continue;
    }

    // Find all bindings.json files
    const bindingsFiles = findBindingsFiles(packagePath);

    for (const bindingsPath of bindingsFiles) {
      for (const companionDtsPath of resolveExistingCompanionDtsFiles(
        bindingsPath
      )) {
        dtsFiles.add(companionDtsPath);
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
  addCoreClrCarrierEntries(
    entries,
    tsNameToTypeId,
    clrNameToTypeId,
    namespaceToTypeIds
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
