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
 * - Source types get stableIds generated as "{ownerIdentity}:{fullyQualifiedName}"
 * - Assembly types keep their original stableIds from tsbindgen bindings
 * - Lookups by tsName, clrName, or stableId all work uniformly
 */

import type {
  IrInterfaceMember,
  IrParameter,
  IrType,
} from "../../../types/index.js";
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

const sameTypeId = (
  left: TypeId | undefined,
  right: TypeId | undefined
): boolean => (left?.stableId ?? undefined) === (right?.stableId ?? undefined);

const enrichCacheKey = (
  ownerIdentity: string,
  containingFQName: string
): string => `${ownerIdentity}::${containingFQName}`;

type EnrichTypeCache = WeakMap<IrType, Map<string, IrType>>;

const getCachedEnrichedType = (
  cache: EnrichTypeCache,
  type: IrType,
  ownerIdentity: string,
  containingFQName: string
): IrType | undefined =>
  cache.get(type)?.get(enrichCacheKey(ownerIdentity, containingFQName));

const setCachedEnrichedType = (
  cache: EnrichTypeCache,
  type: IrType,
  ownerIdentity: string,
  containingFQName: string,
  enriched: IrType
): IrType => {
  const key = enrichCacheKey(ownerIdentity, containingFQName);
  const scoped = cache.get(type);
  if (scoped) {
    scoped.set(key, enriched);
  } else {
    cache.set(type, new Map([[key, enriched]]));
  }
  return enriched;
};

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE TYPE → NOMINAL ENTRY CONVERSION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate stableId for a source type.
 */
const makeSourceStableId = (
  ownerIdentity: string,
  fullyQualifiedName: string
): string => {
  return `${ownerIdentity}:${fullyQualifiedName}`;
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

const withOptionalUndefined = (
  type: IrType | undefined,
  isOptional: boolean
): IrType | undefined => {
  if (!type || !isOptional) return type;
  if (
    type.kind === "unionType" &&
    type.types.some((t) => t.kind === "primitiveType" && t.name === "undefined")
  ) {
    return type;
  }
  return {
    kind: "unionType",
    types: [type, { kind: "primitiveType", name: "undefined" }],
  };
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
    type: withOptionalUndefined(memberInfo.type, memberInfo.isOptional),
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
  ownerIdentity: string,
  resolveSourceOwnerIdentity: (fullyQualifiedName: string) => string | undefined
): HeritageEdge => {
  const targetName = heritageInfo.typeName;

  if (
    heritageInfo.baseType.kind === "referenceType" &&
    heritageInfo.baseType.typeId
  ) {
    return {
      kind: heritageInfo.kind,
      targetStableId: heritageInfo.baseType.typeId.stableId,
      typeArguments: heritageInfo.baseType.typeArguments ?? [],
    };
  }

  const primitiveStableId = PRIMITIVE_TO_STABLE_ID.get(
    targetName.toLowerCase()
  );

  const targetStableId = primitiveStableId
    ? primitiveStableId
    : makeSourceStableId(
        resolveSourceOwnerIdentity(targetName) ?? ownerIdentity,
        targetName
      );

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
  resolveSourceOwnerIdentity: (fullyQualifiedName: string) => string | undefined
): NominalEntry => {
  const stableId = makeSourceStableId(
    entry.ownerIdentity,
    entry.fullyQualifiedName
  );

  // C# has no type-alias syntax at use sites. For `type X = { ... }` (objectType),
  // the emitter materializes a concrete CLR class named `X__Alias`.
  // The unified universe must reflect that CLR name so cross-module emission
  // (via TypeId.clrName) remains correct and deterministic.
  const clrName =
    entry.kind === "typeAlias" && entry.aliasedType?.kind === "objectType"
      ? `${entry.fullyQualifiedName}__Alias`
      : entry.fullyQualifiedName;

  const typeId = makeTypeId(
    stableId,
    clrName,
    entry.ownerIdentity,
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
    convertHeritageInfo(h, entry.ownerIdentity, resolveSourceOwnerIdentity)
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
    ...(entry.kind === "typeAlias" && entry.aliasedType
      ? { aliasedType: entry.aliasedType }
      : {}),
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

const getSourceTypeIdByFQName = (
  fqName: string,
  sourceRegistry: TypeRegistry,
  entries: ReadonlyMap<string, NominalEntry>
): TypeId | undefined => {
  const sourceEntry = sourceRegistry.resolveNominal(fqName);
  if (!sourceEntry) {
    return undefined;
  }

  return entries.get(
    makeSourceStableId(
      sourceEntry.ownerIdentity,
      sourceEntry.fullyQualifiedName
    )
  )?.typeId;
};

const resolveSourceReferenceTypeId = (
  type: Extract<IrType, { kind: "referenceType" }>,
  sourceRegistry: TypeRegistry,
  entries: ReadonlyMap<string, NominalEntry>,
  tsNameToTypeId: ReadonlyMap<string, TypeId>,
  clrNameToTypeId: ReadonlyMap<string, TypeId>,
  ownerIdentity: string,
  containingFQName: string
): TypeId | undefined => {
  if (type.typeId) {
    return type.typeId;
  }

  if (type.resolvedClrType) {
    const byClrName = clrNameToTypeId.get(type.resolvedClrType);
    if (byClrName) {
      return byClrName;
    }
  }

  if (type.name.includes(".")) {
    return (
      getSourceTypeIdByFQName(type.name, sourceRegistry, entries) ??
      clrNameToTypeId.get(type.name) ??
      tsNameToTypeId.get(type.name)
    );
  }

  const lastDot = containingFQName.lastIndexOf(".");
  const containingNamespace =
    lastDot >= 0 ? containingFQName.slice(0, lastDot) : undefined;
  if (containingNamespace) {
    const siblingFQName = `${containingNamespace}.${type.name}`;
    const siblingEntry = sourceRegistry.resolveNominal(siblingFQName);
    if (siblingEntry && siblingEntry.ownerIdentity === ownerIdentity) {
      return entries.get(
        makeSourceStableId(
          siblingEntry.ownerIdentity,
          siblingEntry.fullyQualifiedName
        )
      )?.typeId;
    }
  }

  const sameOwnerMatches = sourceRegistry
    .getFQNames(type.name)
    .map((fqName) => sourceRegistry.resolveNominal(fqName))
    .filter(
      (entry): entry is TypeRegistryEntry =>
        entry !== undefined && entry.ownerIdentity === ownerIdentity
    );
  if (sameOwnerMatches.length === 1) {
    const [onlyMatch] = sameOwnerMatches;
    return onlyMatch
      ? entries.get(
          makeSourceStableId(
            onlyMatch.ownerIdentity,
            onlyMatch.fullyQualifiedName
          )
        )?.typeId
      : undefined;
  }

  const uniqueSourceFQName = sourceRegistry.getFQName(type.name);
  if (uniqueSourceFQName) {
    const uniqueSourceTypeId = getSourceTypeIdByFQName(
      uniqueSourceFQName,
      sourceRegistry,
      entries
    );
    if (uniqueSourceTypeId) {
      return uniqueSourceTypeId;
    }
  }

  return tsNameToTypeId.get(type.name) ?? clrNameToTypeId.get(type.name);
};

const enrichSourceTypeParameters = (
  typeParameters: readonly TypeParameterEntry[],
  enrichType: (type: IrType | undefined) => IrType | undefined
): readonly TypeParameterEntry[] => {
  let changed = false;
  const next = typeParameters.map((typeParameter) => {
    const constraint = typeParameter.constraint
      ? enrichType(typeParameter.constraint)
      : undefined;
    const defaultType = typeParameter.defaultType
      ? enrichType(typeParameter.defaultType)
      : undefined;
    const nextTypeParameter =
      constraint !== typeParameter.constraint ||
      defaultType !== typeParameter.defaultType
        ? {
            ...typeParameter,
            ...(constraint ? { constraint } : {}),
            ...(defaultType ? { defaultType } : {}),
          }
        : typeParameter;
    if (nextTypeParameter !== typeParameter) {
      changed = true;
    }
    return nextTypeParameter;
  });
  return changed ? next : typeParameters;
};

const enrichSourceParameters = (
  parameters: readonly IrParameter[],
  enrichType: (type: IrType | undefined) => IrType | undefined
): readonly IrParameter[] => {
  let changed = false;
  const next = parameters.map((parameter) => {
    const type = parameter.type ? enrichType(parameter.type) : undefined;
    const nextParameter =
      type && type !== parameter.type
        ? {
            ...parameter,
            type,
          }
        : parameter;
    if (nextParameter !== parameter) {
      changed = true;
    }
    return nextParameter;
  });
  return changed ? next : parameters;
};

const enrichSourceInterfaceMembers = (
  members: readonly IrInterfaceMember[],
  enrichType: (type: IrType | undefined) => IrType | undefined
): readonly IrInterfaceMember[] => {
  let changed = false;
  const next = members.map((member) => {
    if (member.kind === "propertySignature") {
      const type = enrichType(member.type) ?? member.type;
      const nextMember =
        type !== member.type
          ? {
              ...member,
              type,
            }
          : member;
      if (nextMember !== member) {
        changed = true;
      }
      return nextMember;
    }

    const parameters = enrichSourceParameters(member.parameters, enrichType);
    const returnType = member.returnType
      ? (enrichType(member.returnType) ?? member.returnType)
      : undefined;
    const typeParameters = member.typeParameters
      ? (() => {
          let typeParametersChanged = false;
          const nextTypeParameters = member.typeParameters.map(
            (typeParameter) => {
              const constraint = typeParameter.constraint
                ? (enrichType(typeParameter.constraint) ??
                  typeParameter.constraint)
                : undefined;
              const defaultType = typeParameter.default
                ? (enrichType(typeParameter.default) ?? typeParameter.default)
                : undefined;
              const nextTypeParameter =
                constraint !== typeParameter.constraint ||
                defaultType !== typeParameter.default
                  ? {
                      ...typeParameter,
                      ...(constraint ? { constraint } : {}),
                      ...(defaultType ? { default: defaultType } : {}),
                    }
                  : typeParameter;
              if (nextTypeParameter !== typeParameter) {
                typeParametersChanged = true;
              }
              return nextTypeParameter;
            }
          );
          return typeParametersChanged
            ? nextTypeParameters
            : member.typeParameters;
        })()
      : undefined;
    const nextMember =
      parameters !== member.parameters ||
      returnType !== member.returnType ||
      typeParameters !== member.typeParameters
        ? {
            ...member,
            parameters,
            ...(returnType ? { returnType } : {}),
            ...(typeParameters ? { typeParameters } : {}),
          }
        : member;
    if (nextMember !== member) {
      changed = true;
    }
    return nextMember;
  });
  return changed ? next : members;
};

const enrichSourceIrType = (
  type: IrType | undefined,
  sourceRegistry: TypeRegistry,
  entries: ReadonlyMap<string, NominalEntry>,
  tsNameToTypeId: ReadonlyMap<string, TypeId>,
  clrNameToTypeId: ReadonlyMap<string, TypeId>,
  ownerIdentity: string,
  containingFQName: string,
  cache: EnrichTypeCache
): IrType | undefined => {
  if (!type) {
    return undefined;
  }

  const cached = getCachedEnrichedType(
    cache,
    type,
    ownerIdentity,
    containingFQName
  );
  if (cached) {
    return cached;
  }

  const enrichNestedType = (nested: IrType | undefined): IrType | undefined =>
    enrichSourceIrType(
      nested,
      sourceRegistry,
      entries,
      tsNameToTypeId,
      clrNameToTypeId,
      ownerIdentity,
      containingFQName,
      cache
    );

  switch (type.kind) {
    case "referenceType": {
      const typeId = resolveSourceReferenceTypeId(
        type,
        sourceRegistry,
        entries,
        tsNameToTypeId,
        clrNameToTypeId,
        ownerIdentity,
        containingFQName
      );
      const typeArguments = type.typeArguments
        ? (() => {
            let changed = false;
            const next = type.typeArguments.map((typeArgument) => {
              const enrichedTypeArgument =
                enrichNestedType(typeArgument) ?? typeArgument;
              if (enrichedTypeArgument !== typeArgument) {
                changed = true;
              }
              return enrichedTypeArgument;
            });
            return changed ? next : type.typeArguments;
          })()
        : undefined;
      const structuralMembers = type.structuralMembers
        ? enrichSourceInterfaceMembers(type.structuralMembers, enrichNestedType)
        : undefined;
      const enriched =
        !sameTypeId(type.typeId, typeId) ||
        typeArguments !== type.typeArguments ||
        structuralMembers !== type.structuralMembers
          ? {
              ...type,
              ...(typeId ? { typeId } : {}),
              ...(typeArguments ? { typeArguments } : {}),
              ...(structuralMembers
                ? {
                    structuralMembers,
                    structuralOrigin: type.structuralOrigin ?? "namedReference",
                  }
                : {}),
            }
          : type;
      return setCachedEnrichedType(
        cache,
        type,
        ownerIdentity,
        containingFQName,
        enriched
      );
    }

    case "arrayType": {
      const elementType =
        enrichNestedType(type.elementType) ?? type.elementType;
      const enriched =
        elementType !== type.elementType
          ? {
              ...type,
              elementType,
            }
          : type;
      return setCachedEnrichedType(
        cache,
        type,
        ownerIdentity,
        containingFQName,
        enriched
      );
    }

    case "tupleType": {
      let changed = false;
      const elementTypes = type.elementTypes.map((elementType) => {
        const enrichedElementType =
          enrichNestedType(elementType) ?? elementType;
        if (enrichedElementType !== elementType) {
          changed = true;
        }
        return enrichedElementType;
      });
      const enriched = changed
        ? {
            ...type,
            elementTypes,
          }
        : type;
      return setCachedEnrichedType(
        cache,
        type,
        ownerIdentity,
        containingFQName,
        enriched
      );
    }

    case "functionType": {
      const typeParameters = type.typeParameters
        ? (() => {
            let changed = false;
            const next = type.typeParameters.map((typeParameter) => {
              const constraint = typeParameter.constraint
                ? (enrichNestedType(typeParameter.constraint) ??
                  typeParameter.constraint)
                : undefined;
              const defaultType = typeParameter.default
                ? (enrichNestedType(typeParameter.default) ??
                  typeParameter.default)
                : undefined;
              const nextTypeParameter =
                constraint !== typeParameter.constraint ||
                defaultType !== typeParameter.default
                  ? {
                      ...typeParameter,
                      ...(constraint ? { constraint } : {}),
                      ...(defaultType ? { default: defaultType } : {}),
                    }
                  : typeParameter;
              if (nextTypeParameter !== typeParameter) {
                changed = true;
              }
              return nextTypeParameter;
            });
            return changed ? next : type.typeParameters;
          })()
        : undefined;
      const parameters = enrichSourceParameters(
        type.parameters,
        enrichNestedType
      );
      const returnType = enrichNestedType(type.returnType) ?? type.returnType;
      const enriched =
        typeParameters !== type.typeParameters ||
        parameters !== type.parameters ||
        returnType !== type.returnType
          ? {
              ...type,
              ...(typeParameters ? { typeParameters } : {}),
              parameters,
              returnType,
            }
          : type;
      return setCachedEnrichedType(
        cache,
        type,
        ownerIdentity,
        containingFQName,
        enriched
      );
    }

    case "objectType": {
      const members = enrichSourceInterfaceMembers(
        type.members,
        enrichNestedType
      );
      const enriched =
        members !== type.members
          ? {
              ...type,
              members,
            }
          : type;
      return setCachedEnrichedType(
        cache,
        type,
        ownerIdentity,
        containingFQName,
        enriched
      );
    }

    case "dictionaryType": {
      const keyType = enrichNestedType(type.keyType) ?? type.keyType;
      const valueType = enrichNestedType(type.valueType) ?? type.valueType;
      const enriched =
        keyType !== type.keyType || valueType !== type.valueType
          ? {
              ...type,
              keyType,
              valueType,
            }
          : type;
      return setCachedEnrichedType(
        cache,
        type,
        ownerIdentity,
        containingFQName,
        enriched
      );
    }

    case "unionType":
    case "intersectionType": {
      let changed = false;
      const types = type.types.map((member) => {
        const enrichedMember = enrichNestedType(member) ?? member;
        if (enrichedMember !== member) {
          changed = true;
        }
        return enrichedMember;
      });
      const enriched = changed
        ? {
            ...type,
            types,
          }
        : type;
      return setCachedEnrichedType(
        cache,
        type,
        ownerIdentity,
        containingFQName,
        enriched
      );
    }

    default:
      return setCachedEnrichedType(
        cache,
        type,
        ownerIdentity,
        containingFQName,
        type
      );
  }
};

const enrichSourceNominalEntry = (
  entry: NominalEntry,
  sourceRegistry: TypeRegistry,
  entries: ReadonlyMap<string, NominalEntry>,
  tsNameToTypeId: ReadonlyMap<string, TypeId>,
  clrNameToTypeId: ReadonlyMap<string, TypeId>,
  cache: EnrichTypeCache
): NominalEntry => {
  if (entry.origin !== "source") {
    return entry;
  }

  const enrichType = (type: IrType | undefined): IrType | undefined =>
    enrichSourceIrType(
      type,
      sourceRegistry,
      entries,
      tsNameToTypeId,
      clrNameToTypeId,
      entry.typeId.assemblyName,
      entry.typeId.clrName,
      cache
    );

  let membersChanged = false;
  const members = new Map<string, MemberEntry>();
  for (const [name, member] of entry.members) {
    const type = member.type ? enrichType(member.type) : undefined;
    const signatures = member.signatures
      ? (() => {
          let changed = false;
          const next = member.signatures.map((signature) => {
            const parameters = signature.parameters.map((parameter) => {
              const parameterType =
                enrichType(parameter.type) ?? parameter.type;
              return parameterType !== parameter.type
                ? {
                    ...parameter,
                    type: parameterType,
                  }
                : parameter;
            });
            const parametersChanged = parameters.some(
              (parameter, index) => parameter !== signature.parameters[index]
            );
            const returnType =
              enrichType(signature.returnType) ?? signature.returnType;
            const typeParameters = enrichSourceTypeParameters(
              signature.typeParameters,
              enrichType
            );
            const nextSignature =
              parametersChanged ||
              returnType !== signature.returnType ||
              typeParameters !== signature.typeParameters
                ? {
                    ...signature,
                    parameters,
                    returnType,
                    typeParameters,
                  }
                : signature;
            if (nextSignature !== signature) {
              changed = true;
            }
            return nextSignature;
          });
          return changed ? next : member.signatures;
        })()
      : undefined;
    const nextMember =
      type !== member.type || signatures !== member.signatures
        ? {
            ...member,
            ...(type ? { type } : {}),
            ...(signatures ? { signatures } : {}),
          }
        : member;
    if (nextMember !== member) {
      membersChanged = true;
    }
    members.set(name, nextMember);
  }

  const aliasedType = entry.aliasedType
    ? enrichType(entry.aliasedType)
    : undefined;
  const typeParameters = enrichSourceTypeParameters(
    entry.typeParameters,
    enrichType
  );
  let heritageChanged = false;
  const heritage = entry.heritage.map((edge) => {
    let typeArgumentsChanged = false;
    const typeArguments = edge.typeArguments.map((typeArgument) => {
      const enrichedTypeArgument = enrichType(typeArgument) ?? typeArgument;
      if (enrichedTypeArgument !== typeArgument) {
        typeArgumentsChanged = true;
      }
      return enrichedTypeArgument;
    });
    const nextEdge = typeArgumentsChanged
      ? {
          ...edge,
          typeArguments,
        }
      : edge;
    if (nextEdge !== edge) {
      heritageChanged = true;
    }
    return nextEdge;
  });

  if (
    aliasedType === entry.aliasedType &&
    typeParameters === entry.typeParameters &&
    !heritageChanged &&
    !membersChanged
  ) {
    return entry;
  }

  return {
    ...entry,
    ...(aliasedType ? { aliasedType } : {}),
    typeParameters,
    heritage: heritageChanged ? heritage : entry.heritage,
    members: membersChanged ? members : entry.members,
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
 * @param projectName - Fallback owner identity for local project source types
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
  const sourceTsNamePriority = new Map<string, number>();
  const sourceClrNamePriority = new Map<string, number>();
  const enrichTypeCache: EnrichTypeCache = new WeakMap();

  // Add source types if registry is provided
  if (sourceRegistry) {
    const resolveSourceOwnerIdentity = (
      fullyQualifiedName: string
    ): string | undefined =>
      sourceRegistry.resolveNominal(fullyQualifiedName)?.ownerIdentity;

    const sourceTypeNames = sourceRegistry.getAllTypeNames();
    for (const fqName of sourceTypeNames) {
      const entry = sourceRegistry.resolveNominal(fqName);
      if (!entry) continue;

      const nominalEntry = convertRegistryEntry(
        {
          ...entry,
          ownerIdentity: entry.ownerIdentity || projectName,
        },
        resolveSourceOwnerIdentity
      );
      const preserveAssemblyIdentity =
        entry.preservesAssemblyIdentity === true &&
        assemblyCatalog.tsNameToTypeId.has(entry.name);

      // Add to maps (source types won't collide with assembly types by stableId)
      entries.set(nominalEntry.typeId.stableId, nominalEntry);
      if (!preserveAssemblyIdentity) {
        const sourcePriority = entry.isDeclarationFile ? 0 : 1;

        const existingTsPriority = sourceTsNamePriority.get(
          nominalEntry.typeId.tsName
        );
        if (
          existingTsPriority === undefined ||
          sourcePriority >= existingTsPriority
        ) {
          tsNameToTypeId.set(nominalEntry.typeId.tsName, nominalEntry.typeId);
          sourceTsNamePriority.set(nominalEntry.typeId.tsName, sourcePriority);
        }

        const existingClrPriority = sourceClrNamePriority.get(
          nominalEntry.typeId.clrName
        );
        if (
          existingClrPriority === undefined ||
          sourcePriority >= existingClrPriority
        ) {
          clrNameToTypeId.set(nominalEntry.typeId.clrName, nominalEntry.typeId);
          sourceClrNamePriority.set(
            nominalEntry.typeId.clrName,
            sourcePriority
          );
        }
      }
    }
    for (const [stableId, entry] of entries) {
      if (entry.origin !== "source") {
        continue;
      }

      entries.set(
        stableId,
        enrichSourceNominalEntry(
          entry,
          sourceRegistry,
          entries,
          tsNameToTypeId,
          clrNameToTypeId,
          enrichTypeCache
        )
      );
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
