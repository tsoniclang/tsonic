/**
 * NominalEnv - Inheritance instantiation environment
 *
 * Phase 6 (Alice's spec): TypeId-based, Universe-driven.
 *
 * Computes type parameter substitution through inheritance chains
 * deterministically, using only the UnifiedTypeCatalog (no TypeNodes).
 */

import type { IrType } from "../../types/index.js";
import type {
  UnifiedTypeCatalog,
  TypeId,
  HeritageEdge,
} from "./universe/types.js";

/**
 * Map from type parameter name to concrete IR type
 */
export type InstantiationEnv = ReadonlyMap<string, IrType>;

/**
 * Substitution result for a specific type in the inheritance chain
 */
export type SubstitutionResult = {
  readonly declaringTypeId: TypeId;
  readonly substitution: InstantiationEnv;
};

/**
 * NominalEnv API - Phase 6: TypeId-based
 */
export type NominalEnv = {
  /**
   * Find which nominal type in the inheritance chain declares a given member.
   * Returns the TypeId and the substitution needed to access that member.
   */
  readonly findMemberDeclaringType: (
    receiverTypeId: TypeId,
    receiverTypeArgs: readonly IrType[],
    memberName: string
  ) => SubstitutionResult | undefined;

  /**
   * Get type parameter substitution for accessing a member from a target type
   * when the receiver has the given TypeId and type arguments.
   *
   * Example:
   * ```typescript
   * class SomeBase<T> { value: List<T>; }
   * class SomeClass extends SomeBase<int> {}
   *
   * // getInstantiation(SomeClassId, [], SomeBaseId)
   * // → { "T" → int }
   * ```
   */
  readonly getInstantiation: (
    receiverTypeId: TypeId,
    receiverTypeArgs: readonly IrType[],
    targetTypeId: TypeId
  ) => InstantiationEnv | undefined;

  /**
   * Get the complete inheritance chain for a nominal type.
   * Returns TypeIds in order from child to parent.
   *
   * Only follows "extends" edges (matches legacy behavior).
   */
  readonly getInheritanceChain: (typeId: TypeId) => readonly TypeId[];
};

/**
 * Apply a substitution map to an IrType.
 * Replaces typeParameterType nodes with their concrete values.
 */
export const substituteIrType = (
  type: IrType,
  subst: InstantiationEnv
): IrType => {
  switch (type.kind) {
    case "typeParameterType": {
      const replacement = subst.get(type.name);
      return replacement ?? type;
    }

    case "referenceType": {
      // Check if the type itself is a type parameter (legacy format)
      const replacement = subst.get(type.name);
      if (replacement) return replacement;

      // Substitute in type arguments and structural members
      const hasTypeArgs = type.typeArguments && type.typeArguments.length > 0;
      const hasStructural =
        type.structuralMembers && type.structuralMembers.length > 0;

      if (hasTypeArgs || hasStructural) {
        return {
          ...type,
          typeArguments: hasTypeArgs
            ? type.typeArguments!.map((arg) => substituteIrType(arg, subst))
            : type.typeArguments,
          structuralMembers: hasStructural
            ? type.structuralMembers!.map((m) => {
                if (m.kind === "propertySignature") {
                  return {
                    ...m,
                    type: substituteIrType(m.type, subst),
                  };
                }
                // methodSignature
                return {
                  ...m,
                  returnType: m.returnType
                    ? substituteIrType(m.returnType, subst)
                    : m.returnType,
                  parameters: m.parameters.map((p) => ({
                    ...p,
                    type: p.type ? substituteIrType(p.type, subst) : p.type,
                  })),
                };
              })
            : type.structuralMembers,
        };
      }
      return type;
    }

    case "arrayType": {
      return {
        ...type,
        elementType: substituteIrType(type.elementType, subst),
      };
    }

    case "functionType": {
      return {
        ...type,
        parameters: type.parameters.map((p) => ({
          ...p,
          type: p.type ? substituteIrType(p.type, subst) : p.type,
        })),
        returnType: type.returnType
          ? substituteIrType(type.returnType, subst)
          : type.returnType,
      };
    }

    case "unionType": {
      return {
        ...type,
        types: type.types.map((t) => substituteIrType(t, subst)),
      };
    }

    case "tupleType": {
      return {
        ...type,
        elementTypes: type.elementTypes.map((t) => substituteIrType(t, subst)),
      };
    }

    case "dictionaryType": {
      return {
        ...type,
        keyType: substituteIrType(type.keyType, subst),
        valueType: substituteIrType(type.valueType, subst),
      };
    }

    case "intersectionType": {
      return {
        ...type,
        types: type.types.map((t) => substituteIrType(t, subst)),
      };
    }

    case "objectType": {
      return {
        ...type,
        members: type.members.map((m) => {
          if (m.kind === "propertySignature") {
            return {
              ...m,
              type: substituteIrType(m.type, subst),
            };
          }
          // methodSignature
          return {
            ...m,
            returnType: m.returnType
              ? substituteIrType(m.returnType, subst)
              : m.returnType,
            parameters: m.parameters.map((p) => ({
              ...p,
              type: p.type ? substituteIrType(p.type, subst) : p.type,
            })),
          };
        }),
      };
    }

    default:
      return type;
  }
};

/**
 * Build a NominalEnv from a UnifiedTypeCatalog.
 *
 * Phase 6: Uses ONLY the catalog for all lookups. No TypeRegistry, no TypeNodes.
 *
 * @param catalog The UnifiedTypeCatalog to use for lookups
 */
export const buildNominalEnv = (catalog: UnifiedTypeCatalog): NominalEnv => {
  // Cache for computed inheritance chains
  // Key: stableId
  const inheritanceChainCache = new Map<string, readonly TypeId[]>();

  // Cache for computed instantiations
  // Key: "receiverStableId|serialized args|targetStableId"
  const instantiationCache = new Map<string, InstantiationEnv>();

  /**
   * Serialize type args for cache key.
   */
  const serializeTypeArgs = (typeArgs: readonly IrType[]): string => {
    if (typeArgs.length === 0) return "";
    return typeArgs.map((a) => JSON.stringify(a)).join(",");
  };

  /**
   * Get the inheritance chain for a nominal type.
   * Returns TypeIds in order from child to parent.
   * Only follows "extends" edges (matches legacy behavior).
   */
  const getInheritanceChain = (typeId: TypeId): readonly TypeId[] => {
    const cached = inheritanceChainCache.get(typeId.stableId);
    if (cached) return cached;

    const chain: TypeId[] = [typeId];
    const visited = new Set<string>();
    visited.add(typeId.stableId);

    const walkHeritage = (currentTypeId: TypeId): void => {
      const heritage = catalog.getHeritage(currentTypeId);

      for (const edge of heritage) {
        // Only follow "extends" edges (not "implements")
        if (edge.kind !== "extends") continue;
        if (visited.has(edge.targetStableId)) continue;

        const parentEntry = catalog.getByStableId(edge.targetStableId);
        if (!parentEntry) continue;

        visited.add(edge.targetStableId);
        chain.push(parentEntry.typeId);
        walkHeritage(parentEntry.typeId);
      }
    };

    walkHeritage(typeId);
    inheritanceChainCache.set(typeId.stableId, chain);
    return chain;
  };

  /**
   * Find the heritage edge from child to parent.
   */
  const findHeritageEdge = (
    childTypeId: TypeId,
    parentStableId: string
  ): HeritageEdge | undefined => {
    const heritage = catalog.getHeritage(childTypeId);
    return heritage.find(
      (edge) => edge.kind === "extends" && edge.targetStableId === parentStableId
    );
  };

  /**
   * Build substitution map for a specific step in the inheritance chain.
   * Maps the parent type's type parameters to the concrete types from the heritage clause.
   *
   * Uses pure IR: HeritageEdge.typeArguments is already IrType[].
   */
  const buildStepSubstitution = (
    childTypeId: TypeId,
    parentTypeId: TypeId,
    parentSubst: InstantiationEnv
  ): InstantiationEnv => {
    // Find the heritage edge from child to parent
    const edge = findHeritageEdge(childTypeId, parentTypeId.stableId);
    if (!edge) return new Map();

    // Get the parent type's type parameters
    const parentTypeParams = catalog.getTypeParameters(parentTypeId);

    // Build substitution map: parent type param → concrete type
    const subst = new Map<string, IrType>();
    for (let i = 0; i < parentTypeParams.length; i++) {
      const paramName = parentTypeParams[i]?.name;
      const argType = edge.typeArguments[i];
      if (paramName && argType) {
        // Apply parent substitution (in case the arg contains type params from child)
        const substitutedArgType = substituteIrType(argType, parentSubst);
        subst.set(paramName, substitutedArgType);
      }
    }

    return subst;
  };

  /**
   * Get instantiation for a specific target in the inheritance chain.
   */
  const getInstantiation = (
    receiverTypeId: TypeId,
    receiverTypeArgs: readonly IrType[],
    targetTypeId: TypeId
  ): InstantiationEnv | undefined => {
    // Check cache
    const cacheKey = `${receiverTypeId.stableId}|${serializeTypeArgs(receiverTypeArgs)}|${targetTypeId.stableId}`;
    const cached = instantiationCache.get(cacheKey);
    if (cached) return cached;

    // If receiver is the target, build initial substitution from receiver's type args
    if (receiverTypeId.stableId === targetTypeId.stableId) {
      const receiverTypeParams = catalog.getTypeParameters(receiverTypeId);
      const subst = new Map<string, IrType>();
      for (let i = 0; i < receiverTypeParams.length; i++) {
        const paramName = receiverTypeParams[i]?.name;
        const arg = receiverTypeArgs[i];
        if (paramName && arg) {
          subst.set(paramName, arg);
        }
      }
      instantiationCache.set(cacheKey, subst);
      return subst;
    }

    // Get inheritance chain
    const chain = getInheritanceChain(receiverTypeId);

    // Find target in chain by stableId
    const targetIndex = chain.findIndex(
      (t) => t.stableId === targetTypeId.stableId
    );
    if (targetIndex === -1) return undefined;

    // Build substitution by walking the chain
    // Start with receiver's type args
    const receiverTypeParams = catalog.getTypeParameters(receiverTypeId);
    let currentSubst = new Map<string, IrType>();
    for (let i = 0; i < receiverTypeParams.length; i++) {
      const paramName = receiverTypeParams[i]?.name;
      const arg = receiverTypeArgs[i];
      if (paramName && arg) {
        currentSubst.set(paramName, arg);
      }
    }

    // Walk from receiver to target, accumulating substitutions
    for (let i = 0; i < targetIndex; i++) {
      const childTypeId = chain[i];
      const parentTypeId = chain[i + 1];
      if (!childTypeId || !parentTypeId) continue;

      const stepSubst = buildStepSubstitution(
        childTypeId,
        parentTypeId,
        currentSubst
      );

      // The step substitution maps parent's params to concrete types
      currentSubst = new Map(stepSubst);
    }

    instantiationCache.set(cacheKey, currentSubst);
    return currentSubst;
  };

  /**
   * Find which type in the inheritance chain declares a given member.
   */
  const findMemberDeclaringType = (
    receiverTypeId: TypeId,
    receiverTypeArgs: readonly IrType[],
    memberName: string
  ): SubstitutionResult | undefined => {
    const chain = getInheritanceChain(receiverTypeId);

    for (const typeId of chain) {
      const member = catalog.getMember(typeId, memberName);
      if (member) {
        const subst = getInstantiation(
          receiverTypeId,
          receiverTypeArgs,
          typeId
        );
        if (subst) {
          return {
            declaringTypeId: typeId,
            substitution: subst,
          };
        }
      }
    }

    return undefined;
  };

  return {
    getInstantiation,
    findMemberDeclaringType,
    getInheritanceChain,
  };
};
