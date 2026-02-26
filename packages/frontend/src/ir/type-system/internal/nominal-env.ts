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
      // Substitute in type arguments and structural members
      const hasTypeArgs = type.typeArguments && type.typeArguments.length > 0;
      const hasStructural =
        type.structuralMembers && type.structuralMembers.length > 0;

      if (hasTypeArgs || hasStructural) {
        return {
          ...type,
          typeArguments: hasTypeArgs
            ? (type.typeArguments ?? []).map((arg) =>
                substituteIrType(arg, subst)
              )
            : type.typeArguments,
          structuralMembers: hasStructural
            ? (type.structuralMembers ?? []).map((m) => {
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
   *
   * Phase 6 (Alice's spec): This must be sufficient for nominal assignability and
   * member lookup across both class inheritance and implemented interfaces.
   */
  const getInheritanceChain = (typeId: TypeId): readonly TypeId[] => {
    const cached = inheritanceChainCache.get(typeId.stableId);
    if (cached) return cached;

    const chain: TypeId[] = [typeId];
    const visited = new Set<string>([typeId.stableId]);

    const queue: TypeId[] = [typeId];

    while (queue.length > 0) {
      const currentTypeId = queue.shift();
      if (!currentTypeId) continue;

      const heritage = [...catalog.getHeritage(currentTypeId)].sort((a, b) => {
        const rank = (k: HeritageEdge["kind"]) => (k === "extends" ? 0 : 1);
        const ra = rank(a.kind);
        const rb = rank(b.kind);
        if (ra !== rb) return ra - rb;
        return a.targetStableId.localeCompare(b.targetStableId);
      });

      for (const edge of heritage) {
        if (visited.has(edge.targetStableId)) continue;

        const parentEntry = catalog.getByStableId(edge.targetStableId);
        if (!parentEntry) continue;

        visited.add(edge.targetStableId);
        chain.push(parentEntry.typeId);
        queue.push(parentEntry.typeId);
      }
    }

    inheritanceChainCache.set(typeId.stableId, chain);
    return chain;
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

    // Start with receiver's type args (receiver param → concrete type)
    const receiverTypeParams = catalog.getTypeParameters(receiverTypeId);
    let currentSubst = new Map<string, IrType>();
    for (let i = 0; i < receiverTypeParams.length; i++) {
      const paramName = receiverTypeParams[i]?.name;
      const arg = receiverTypeArgs[i];
      if (paramName && arg) {
        currentSubst.set(paramName, arg);
      }
    }

    // Graph search through heritage edges (extends + implements), composing substitutions.
    type State = { readonly typeId: TypeId; readonly subst: InstantiationEnv };

    const serializeSubst = (
      typeId: TypeId,
      subst: InstantiationEnv
    ): string => {
      const typeParams = catalog.getTypeParameters(typeId);
      return typeParams
        .map((tp) => JSON.stringify(subst.get(tp.name) ?? null))
        .join(",");
    };

    const visited = new Set<string>();
    const queue: State[] = [
      {
        typeId: receiverTypeId,
        subst: currentSubst,
      },
    ];

    while (queue.length > 0) {
      const state = queue.shift();
      if (!state) continue;

      if (state.typeId.stableId === targetTypeId.stableId) {
        instantiationCache.set(cacheKey, state.subst);
        return state.subst;
      }

      const heritage = [...catalog.getHeritage(state.typeId)].sort((a, b) => {
        const rank = (k: HeritageEdge["kind"]) => (k === "extends" ? 0 : 1);
        const ra = rank(a.kind);
        const rb = rank(b.kind);
        if (ra !== rb) return ra - rb;
        return a.targetStableId.localeCompare(b.targetStableId);
      });

      for (const edge of heritage) {
        const parentEntry = catalog.getByStableId(edge.targetStableId);
        if (!parentEntry) continue;

        const parentTypeId = parentEntry.typeId;
        const parentTypeParams = catalog.getTypeParameters(parentTypeId);

        const nextSubst = new Map<string, IrType>();
        for (let i = 0; i < parentTypeParams.length; i++) {
          const paramName = parentTypeParams[i]?.name;
          const argType = edge.typeArguments[i];
          if (paramName && argType) {
            nextSubst.set(paramName, substituteIrType(argType, state.subst));
          }
        }

        const visitKey = `${parentTypeId.stableId}|${serializeSubst(parentTypeId, nextSubst)}`;
        if (visited.has(visitKey)) continue;
        visited.add(visitKey);

        queue.push({ typeId: parentTypeId, subst: nextSubst });
      }
    }

    return undefined;
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
