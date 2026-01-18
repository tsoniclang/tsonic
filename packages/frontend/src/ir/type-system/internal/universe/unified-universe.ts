/**
 * Unified Type Universe
 *
 * Merges source-authored types (from TypeRegistry) and assembly-authored
 * types (from ClrCatalog) into a single unified lookup table.
 *
 * INVARIANT INV-CLR: This is THE source of truth for all type queries.
 * No fallback paths allowed. If a type isn't in this catalog, it doesn't exist.
 *
 * Design:
 * - Source types get stableIds generated as "{projectName}:{fullyQualifiedName}"
 * - Assembly types keep their original stableIds from tsbindgen bindings
 * - Lookups by tsName, clrName, or stableId all work uniformly
 */

import type { IrType } from "../../../types/index.js";
import type {
  TypeId,
  NominalEntry,
  NominalKind,
  MemberEntry,
  HeritageEdge,
  TypeParameterEntry,
  AssemblyTypeCatalog,
  UnifiedTypeCatalog,
} from "./types.js";
import { makeTypeId, PRIMITIVE_TO_STABLE_ID } from "./types.js";
import type {
  TypeRegistry,
  TypeRegistryEntry,
  MemberInfo,
  HeritageInfo,
} from "../type-registry.js";

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE TYPE → NOMINAL ENTRY CONVERSION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate stableId for a source type.
 */
const makeSourceStableId = (
  projectName: string,
  fullyQualifiedName: string
): string => {
  return `${projectName}:${fullyQualifiedName}`;
};

/**
 * Extract name from IrParameter pattern.
 */
const getParameterName = (
  param: {
    readonly pattern: { readonly kind: string; readonly name?: string };
  },
  index: number
): string => {
  if (param.pattern.kind === "identifierPattern" && param.pattern.name) {
    return param.pattern.name;
  }
  return `p${index}`;
};

/**
 * Convert MemberInfo from TypeRegistry to MemberEntry for unified catalog.
 */
const convertMemberInfo = (
  memberInfo: MemberInfo,
  parentFQName: string
): MemberEntry => {
  // Determine member kind
  const memberKind =
    memberInfo.kind === "method"
      ? "method"
      : memberInfo.kind === "indexSignature"
        ? "property" // Treat index signatures as properties
        : "property";

  return {
    tsName: memberInfo.name,
    clrName: memberInfo.name,
    memberKind,
    type: memberInfo.type,
    signatures: memberInfo.methodSignatures?.map((sig) => ({
      stableId: `${parentFQName}::${memberInfo.name}`,
      parameters: sig.parameters.map((p, i) => ({
        name: getParameterName(p, i),
        type: p.type ?? { kind: "unknownType" as const }, // Default to unknown if no type
        mode: "value" as const,
        isOptional: p.isOptional ?? false,
        isRest: p.isRest ?? false,
      })),
      returnType: sig.returnType ?? { kind: "voidType" as const },
      typeParameters:
        sig.typeParameters?.map((tp) => ({
          name: tp.name,
          constraint: tp.constraint,
          defaultType: tp.default,
        })) ?? [],
      parameterCount: sig.parameters.length,
      isStatic: false, // Source methods are instance by default unless marked
      isExtensionMethod: false,
      normalizedSignature: `${memberInfo.name}|${sig.parameters.map((p) => p.type?.kind ?? "unknown").join(",")}`,
    })),
    isStatic: false, // Would need to check actual declaration
    isReadonly: memberInfo.isReadonly,
    isAbstract: false,
    isVirtual: false,
    isOverride: false,
    isIndexer: memberInfo.kind === "indexSignature",
    hasGetter: true,
    hasSetter: !memberInfo.isReadonly,
    stableId: `${parentFQName}::${memberInfo.name}`,
  };
};

/**
 * Convert HeritageInfo from TypeRegistry to HeritageEdge for unified catalog.
 */
const convertHeritageInfo = (
  heritageInfo: HeritageInfo,
  projectName: string
): HeritageEdge => {
  // Determine the target type's stableId
  // This is tricky - we need to figure out if it's a source type or assembly type
  const targetName = heritageInfo.typeName;

  // Check if it's a primitive that maps to a CLR type
  const primitiveStableId = PRIMITIVE_TO_STABLE_ID.get(
    targetName.toLowerCase()
  );

  // For now, assume source types for unresolved names
  const targetStableId = primitiveStableId
    ? primitiveStableId
    : makeSourceStableId(projectName, targetName);

  // Extract type arguments from the baseType if it's a reference type
  const typeArguments: IrType[] = [];
  if (
    heritageInfo.baseType.kind === "referenceType" &&
    heritageInfo.baseType.typeArguments
  ) {
    typeArguments.push(...heritageInfo.baseType.typeArguments);
  }

  return {
    kind: heritageInfo.kind,
    targetStableId,
    typeArguments,
  };
};

/**
 * Convert TypeRegistryEntry to NominalEntry for unified catalog.
 */
const convertRegistryEntry = (
  entry: TypeRegistryEntry,
  projectName: string
): NominalEntry => {
  const stableId = makeSourceStableId(projectName, entry.fullyQualifiedName);

  const typeId = makeTypeId(
    stableId,
    entry.fullyQualifiedName, // CLR name = FQ name for source types
    projectName,
    entry.name // TS name = simple name
  );

  // Convert kind
  const kindMap: Record<string, NominalKind> = {
    class: "class",
    interface: "interface",
    typeAlias: "interface", // Type aliases treated as interfaces
  };
  const kind = kindMap[entry.kind] ?? "class";

  // Convert members
  const members = new Map<string, MemberEntry>();
  for (const [name, memberInfo] of entry.members) {
    members.set(name, convertMemberInfo(memberInfo, entry.fullyQualifiedName));
  }

  // Convert heritage
  const heritage = entry.heritage.map((h) =>
    convertHeritageInfo(h, projectName)
  );

  // Convert type parameters
  const typeParameters: TypeParameterEntry[] = entry.typeParameters.map(
    (tp) => ({
      name: tp.name,
      constraint: tp.constraint,
      defaultType: tp.defaultType,
    })
  );

  return {
    typeId,
    kind,
    typeParameters,
    heritage,
    members,
    origin: "source",
    accessibility: "public", // Source types are public by default
    isAbstract: false, // Would need AST info
    isSealed: false,
    isStatic: false,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED CATALOG BUILDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a unified type catalog from source and assembly catalogs.
 *
 * @param sourceRegistry - TypeRegistry containing source-authored types
 * @param assemblyCatalog - AssemblyTypeCatalog containing CLR metadata types
 * @param projectName - Project name for generating source type stableIds
 * @returns UnifiedTypeCatalog with merged type information
 */
export const buildUnifiedUniverse = (
  sourceRegistry: TypeRegistry | undefined,
  assemblyCatalog: AssemblyTypeCatalog,
  projectName: string = "project"
): UnifiedTypeCatalog => {
  // Start with assembly entries (these are the "ground truth" for CLR types)
  const entries = new Map<string, NominalEntry>(assemblyCatalog.entries);
  const tsNameToTypeId = new Map<string, TypeId>(
    assemblyCatalog.tsNameToTypeId
  );
  const clrNameToTypeId = new Map<string, TypeId>(
    assemblyCatalog.clrNameToTypeId
  );

  // Add source types if registry is provided
  if (sourceRegistry) {
    for (const fqName of sourceRegistry.getAllTypeNames()) {
      const entry = sourceRegistry.resolveNominal(fqName);
      if (!entry) continue;

      const nominalEntry = convertRegistryEntry(entry, projectName);

      // Add to maps (source types won't collide with assembly types by stableId)
      entries.set(nominalEntry.typeId.stableId, nominalEntry);
      tsNameToTypeId.set(nominalEntry.typeId.tsName, nominalEntry.typeId);
      clrNameToTypeId.set(nominalEntry.typeId.clrName, nominalEntry.typeId);
    }
  }

  // Build the catalog interface
  const catalog: UnifiedTypeCatalog = {
    getByTypeId: (typeId: TypeId) => entries.get(typeId.stableId),

    getByStableId: (stableId: string) => entries.get(stableId),

    resolveTsName: (tsName: string) => tsNameToTypeId.get(tsName),

    resolveClrName: (clrName: string) => clrNameToTypeId.get(clrName),

    getMembers: (typeId: TypeId) => {
      const entry = entries.get(typeId.stableId);
      return entry?.members ?? new Map();
    },

    getMember: (typeId: TypeId, memberName: string) => {
      const entry = entries.get(typeId.stableId);
      return entry?.members.get(memberName);
    },

    getHeritage: (typeId: TypeId) => {
      const entry = entries.get(typeId.stableId);
      return entry?.heritage ?? [];
    },

    getTypeParameters: (typeId: TypeId) => {
      const entry = entries.get(typeId.stableId);
      return entry?.typeParameters ?? [];
    },

    hasType: (stableId: string) => entries.has(stableId),

    getAllTypeIds: () => {
      const typeIds: TypeId[] = [];
      for (const entry of entries.values()) {
        typeIds.push(entry.typeId);
      }
      return typeIds;
    },
  };

  return catalog;
};

// ═══════════════════════════════════════════════════════════════════════════
// PRIMITIVE TYPE NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize a primitive IrType to its canonical nominal TypeId.
 *
 * This is the key function for unifying primitive types with their CLR counterparts:
 * - primitiveType("string") → TypeId for System.String
 * - primitiveType("int") → TypeId for System.Int32
 * - primitiveType("number") → TypeId for System.Double
 * - primitiveType("boolean") → TypeId for System.Boolean
 *
 * @param type - The IrType to normalize
 * @param catalog - The unified catalog to look up TypeIds
 * @returns The TypeId if this is a primitive that maps to a nominal, undefined otherwise
 */
export const normalizePrimitiveToTypeId = (
  type: IrType,
  catalog: UnifiedTypeCatalog
): TypeId | undefined => {
  if (type.kind !== "primitiveType") return undefined;

  const stableId = PRIMITIVE_TO_STABLE_ID.get(type.name);
  if (!stableId) return undefined;

  const entry = catalog.getByStableId(stableId);
  return entry?.typeId;
};

/**
 * Get the TypeId for an IrType, normalizing primitives as needed.
 *
 * @param type - The IrType to get a TypeId for
 * @param catalog - The unified catalog
 * @returns The TypeId if this type has one, undefined for structural types
 */
export const getTypeId = (
  type: IrType,
  catalog: UnifiedTypeCatalog
): TypeId | undefined => {
  // Handle primitives by normalizing to nominal
  if (type.kind === "primitiveType") {
    return normalizePrimitiveToTypeId(type, catalog);
  }

  // Handle reference types - look up by name
  if (type.kind === "referenceType") {
    // Try clrName first (most specific)
    if (type.resolvedClrType) {
      const typeId = catalog.resolveClrName(type.resolvedClrType);
      if (typeId) return typeId;
    }

    // Try tsName
    const typeId = catalog.resolveTsName(type.name);
    if (typeId) return typeId;

    // Try as clrName
    return catalog.resolveClrName(type.name);
  }

  // Arrays, tuples, functions, unions, intersections, etc. don't have TypeIds
  return undefined;
};

// ═══════════════════════════════════════════════════════════════════════════
// MEMBER LOOKUP WITH INHERITANCE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Look up a member on a type, walking the inheritance chain if necessary.
 *
 * @param typeId - The type to start from
 * @param memberName - The member name (TS name)
 * @param catalog - The unified catalog
 * @returns The member entry if found, undefined otherwise
 */
export const lookupMemberWithInheritance = (
  typeId: TypeId,
  memberName: string,
  catalog: UnifiedTypeCatalog
): MemberEntry | undefined => {
  // Check this type first
  const member = catalog.getMember(typeId, memberName);
  if (member) return member;

  // Walk inheritance chain
  const heritage = catalog.getHeritage(typeId);
  for (const edge of heritage) {
    const parentEntry = catalog.getByStableId(edge.targetStableId);
    if (!parentEntry) continue;

    const result = lookupMemberWithInheritance(
      parentEntry.typeId,
      memberName,
      catalog
    );
    if (result) return result;
  }

  return undefined;
};

/**
 * Get the declared type of a member, normalizing primitives.
 *
 * This is the primary entry point for type queries about members.
 * Returns the IrType of the member, with primitives normalized.
 *
 * @param receiverType - The type of the receiver (object being accessed)
 * @param memberName - The member name (TS name)
 * @param catalog - The unified catalog
 * @returns The member's IrType if found, undefined otherwise
 */
export const getMemberDeclaredType = (
  receiverType: IrType,
  memberName: string,
  catalog: UnifiedTypeCatalog
): IrType | undefined => {
  // Get TypeId for the receiver (normalizing primitives)
  const typeId = getTypeId(receiverType, catalog);
  if (!typeId) return undefined;

  // Look up member with inheritance
  const member = lookupMemberWithInheritance(typeId, memberName, catalog);
  if (!member) return undefined;

  return member.type;
};
