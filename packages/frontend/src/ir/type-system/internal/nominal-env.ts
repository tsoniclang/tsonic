/**
 * NominalEnv - Inheritance instantiation environment
 *
 * TypeId-based nominal environment backed by the unified universe.
 *
 * Computes type parameter substitution through inheritance chains
 * deterministically, using only the UnifiedTypeCatalog (no TypeNodes).
 */

import {
  substituteIrType as substituteSharedIrType,
  type IrType,
} from "../../types/index.js";
import {
  createLocalTypeIdentityState,
  localTypeIdentityKey,
} from "../../types/type-ops.js";
import type {
  UnifiedTypeCatalog,
  TypeId,
  HeritageEdge,
} from "./universe/types.js";

const nominalEnvTypeKeyState = createLocalTypeIdentityState();

const nominalEnvTypeArgKey = (type: IrType): string => {
  return localTypeIdentityKey(type, nominalEnvTypeKeyState);
};

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
 * NominalEnv API: TypeId-based
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
): IrType => substituteSharedIrType(type, subst);

/**
 * Build a NominalEnv from a UnifiedTypeCatalog.
 *
 * Uses only the catalog for lookups. No TypeRegistry or TypeNodes.
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
    return typeArgs.map((a) => nominalEnvTypeArgKey(a)).join(",");
  };

  /**
   * Get the inheritance chain for a nominal type.
   * Returns TypeIds in order from child to parent.
   *
   * This must be sufficient for nominal assignability and
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
        .map((tp) => {
          const arg = subst.get(tp.name);
          return arg ? nominalEnvTypeArgKey(arg) : "null";
        })
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
