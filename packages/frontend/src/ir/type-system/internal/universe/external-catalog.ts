/**
 * External Type Catalog Loader
 *
 * Loads target type metadata from tsbindgen <Namespace>/bindings.json files
 * into a queryable catalog structure.
 *
 * INVARIANT INV-NOMINAL: All external types loaded here become part of the
 * unified type catalog. No parallel lookup paths allowed.
 *
 * The loader:
 * 1. Loads only explicitly participating external package roots
 * 2. Parses bindings.json for type definitions, members, signatures
 * 4. Converts to NominalEntry structures with proper IrType members
 */

import * as fs from "fs";
import * as path from "path";
import { resolveDependencyPackageRoot } from "../../../../program/package-roots.js";
import type { IrType } from "../../../types/index.js";
import type {
  ExternalTypeCatalog,
  TypeId,
  NominalEntry,
  MemberEntry,
  RawBindingsPayload,
} from "./types.js";
import { makeTypeId } from "./types.js";
import { extractRawExternalBindingsPayload } from "../../../../program/external-binding-payload.js";
import {
  convertRawType,
  enrichExternalEntriesFromTsBindgenDts,
} from "./external-entry-converter.js";

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
  parseExternalTypeString,
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
} from "./external-type-parser.js";

export type { TsBindgenDtsTypeInfo } from "./external-entry-converter.js";

export {
  extractHeritageFromTsBindgenDts,
  enrichExternalEntriesFromTsBindgenDts,
  parsePropertyType,
  parseFieldType,
  parseMethodSignature,
  convertRawType,
} from "./external-entry-converter.js";

// ═══════════════════════════════════════════════════════════════════════════
// FILE DISCOVERY AND LOADING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Find all bindings.json files in an explicit external package root.
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
// CORE CARRIERS
// ═══════════════════════════════════════════════════════════════════════════

const CORE_OWNER_IDENTITY = "tsonic.core";

const coreTypeId = (sourceName: string): TypeId =>
  makeTypeId(
    `${CORE_OWNER_IDENTITY}:${sourceName}`,
    sourceName,
    CORE_OWNER_IDENTITY,
    sourceName
  );

const coreProperty = (
  owner: TypeId,
  name: string,
  type: IrType,
  readonly: boolean
): MemberEntry => ({
  tsName: name,
  targetName: name,
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

const createCoreExternalCarrierEntries = (): readonly NominalEntry[] => {
  const arrayTypeId = coreTypeId("Array");
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
    name: "object",
  };

  return [
    {
      typeId: arrayTypeId,
      kind: "class",
      typeParameters: [],
      heritage: [],
      members: new Map([
        ["Length", coreProperty(arrayTypeId, "Length", intType, true)],
        ["Rank", coreProperty(arrayTypeId, "Rank", intType, true)],
        [
          "IsFixedSize",
          coreProperty(arrayTypeId, "IsFixedSize", booleanType, true),
        ],
        [
          "IsReadOnly",
          coreProperty(arrayTypeId, "IsReadOnly", booleanType, true),
        ],
        [
          "IsSynchronized",
          coreProperty(arrayTypeId, "IsSynchronized", booleanType, true),
        ],
        ["SyncRoot", coreProperty(arrayTypeId, "SyncRoot", objectType, true)],
      ]),
      origin: "external",
      accessibility: "public",
      isAbstract: true,
      isSealed: false,
      isStatic: false,
    },
  ];
};

const addCoreExternalCarrierEntries = (
  entries: Map<string, NominalEntry>,
  tsNameToTypeId: Map<string, TypeId>,
  providerNameToTypeId: Map<string, TypeId>,
  namespaceToTypeIds: Map<string, TypeId[]>
): void => {
  for (const entry of createCoreExternalCarrierEntries()) {
    if (entries.has(entry.typeId.stableId)) {
      continue;
    }

    entries.set(entry.typeId.stableId, entry);
    tsNameToTypeId.set(entry.typeId.sourceName, entry.typeId);
    providerNameToTypeId.set(entry.typeId.providerName, entry.typeId);

    const namespaceTypes = namespaceToTypeIds.get("core") ?? [];
    namespaceTypes.push(entry.typeId);
    namespaceToTypeIds.set("core", namespaceTypes);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN LOADER FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Load all external types from explicitly participating external packages.
 *
 * @param _nodeModulesPath - Reserved for call-site stability while catalog
 * loading is driven by explicit package roots.
 * @param extraPackageRoots - Explicit external package roots participating in this build
 * @returns ExternalTypeCatalog with all loaded types
 */
export const loadExternalCatalog = (
  _nodeModulesPath: string,
  extraPackageRoots: readonly string[] = []
): ExternalTypeCatalog => {
  const entries = new Map<string, NominalEntry>();
  const tsNameToTypeId = new Map<string, TypeId>();
  const providerNameToTypeId = new Map<string, TypeId>();
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
    const discoveredExternalBindingsInPackage =
      !sourcePackageRoot && findBindingsFiles(resolvedRoot).length > 0;
    const shouldTraverseDependencies =
      forceDependencyTraversal ||
      sourcePackageRoot ||
      hasBindingsManifest ||
      hasSurfaceManifest ||
      discoveredExternalBindingsInPackage;

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
      const bindings = extractRawExternalBindingsPayload(parsed) as
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
        tsNameToTypeId.set(entry.typeId.sourceName, entry.typeId);
        providerNameToTypeId.set(entry.typeId.providerName, entry.typeId);

        // Add to namespace map
        const nsTypes = namespaceToTypeIds.get(bindings.namespace) ?? [];
        nsTypes.push(entry.typeId);
        namespaceToTypeIds.set(bindings.namespace, nsTypes);
      }
    }
  }

  // Enrich external catalog with heritage edges and type parameter names by parsing
  // tsbindgen internal `index.d.ts` files. This is required for deterministic
  // generic inference through inheritance (e.g., Collection<T> → Iterable<T>).
  enrichExternalEntriesFromTsBindgenDts(
    entries,
    tsNameToTypeId,
    Array.from(dtsFiles).sort()
  );
  addCoreExternalCarrierEntries(
    entries,
    tsNameToTypeId,
    providerNameToTypeId,
    namespaceToTypeIds
  );

  return {
    entries,
    tsNameToTypeId,
    providerNameToTypeId,
    namespaceToTypeIds,
  };
};

/**
 * Load external catalog from a specific package (for testing).
 */
export const loadSinglePackageBindings = (
  bindingsPath: string
): ExternalTypeCatalog => {
  const entries = new Map<string, NominalEntry>();
  const tsNameToTypeId = new Map<string, TypeId>();
  const providerNameToTypeId = new Map<string, TypeId>();
  const namespaceToTypeIds = new Map<string, TypeId[]>();
  const dtsPath = path.join(
    path.dirname(bindingsPath),
    "internal",
    "index.d.ts"
  );

  const content = fs.readFileSync(bindingsPath, "utf-8");
  const parsed = JSON.parse(content) as unknown;
  const bindings = extractRawExternalBindingsPayload(parsed) as
    | RawBindingsPayload
    | undefined;
  if (!bindings) {
    throw new Error(
      `Expected canonical external bindings with 'provider.namespace' and 'targetSurface.types' at ${bindingsPath}`
    );
  }

  for (const rawType of bindings.types) {
    const entry = convertRawType(rawType, bindings.namespace);

    entries.set(entry.typeId.stableId, entry);
    tsNameToTypeId.set(entry.typeId.sourceName, entry.typeId);
    providerNameToTypeId.set(entry.typeId.providerName, entry.typeId);

    const nsTypes = namespaceToTypeIds.get(bindings.namespace) ?? [];
    nsTypes.push(entry.typeId);
    namespaceToTypeIds.set(bindings.namespace, nsTypes);
  }

  if (fs.existsSync(dtsPath)) {
    enrichExternalEntriesFromTsBindgenDts(entries, tsNameToTypeId, [dtsPath]);
  }

  return {
    entries,
    tsNameToTypeId,
    providerNameToTypeId,
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
  catalog: ExternalTypeCatalog,
  stableId: string
): NominalEntry | undefined => {
  return catalog.entries.get(stableId);
};

/**
 * Get a type entry by TS name.
 */
export const getTypeByTsName = (
  catalog: ExternalTypeCatalog,
  tsName: string
): NominalEntry | undefined => {
  const typeId = catalog.tsNameToTypeId.get(tsName);
  return typeId ? catalog.entries.get(typeId.stableId) : undefined;
};

/**
 * Get a type entry by provider target name.
 */
export const getTypeByTargetName = (
  catalog: ExternalTypeCatalog,
  targetName: string
): NominalEntry | undefined => {
  const typeId = catalog.providerNameToTypeId.get(targetName);
  return typeId ? catalog.entries.get(typeId.stableId) : undefined;
};

/**
 * Get a member from a type by TS name.
 */
export const getMemberByTsName = (
  catalog: ExternalTypeCatalog,
  typeStableId: string,
  memberTsName: string
): MemberEntry | undefined => {
  const entry = catalog.entries.get(typeStableId);
  return entry?.members.get(memberTsName);
};
