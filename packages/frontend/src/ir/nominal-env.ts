/**
 * NominalEnv - Inheritance instantiation environment
 *
 * Computes type parameter substitution through inheritance chains
 * deterministically, using only AST TypeNodes from the TypeRegistry.
 *
 * Part of Alice's specification for deterministic IR typing.
 */

import * as ts from "typescript";
import { IrType } from "./types.js";
import { TypeRegistry } from "./type-registry.js";
import type { Binding } from "./binding/index.js";

/**
 * Map from type parameter name to concrete IR type
 */
export type InstantiationEnv = ReadonlyMap<string, IrType>;

/**
 * Function signature for converting TypeNode to IrType
 */
export type ConvertTypeFn = (node: ts.TypeNode, binding: Binding) => IrType;

/**
 * Substitution result for a specific type in the inheritance chain
 */
export type SubstitutionResult = {
  readonly targetNominal: string;
  readonly substitution: InstantiationEnv;
};

/**
 * NominalEnv API
 */
export type NominalEnv = {
  /**
   * Get the type parameter substitution for accessing a member from a target type
   * when the receiver has the given nominal type and type arguments.
   *
   * Example:
   * ```typescript
   * class SomeBase<T> { value: List<T>; }
   * class SomeClass extends SomeBase<int> {}
   *
   * // getInstantiation("SomeClass", [], "SomeBase")
   * // → { "T" → int }
   * ```
   */
  readonly getInstantiation: (
    receiverNominal: string,
    receiverTypeArgs: readonly IrType[],
    targetNominal: string
  ) => InstantiationEnv | undefined;

  /**
   * Find which nominal type in the inheritance chain declares a given member.
   * Returns the nominal name and the substitution needed to access that member.
   */
  readonly findMemberDeclaringType: (
    receiverNominal: string,
    receiverTypeArgs: readonly IrType[],
    memberName: string
  ) => SubstitutionResult | undefined;

  /**
   * Get the complete inheritance chain for a nominal type.
   * Returns types in order from child to parent.
   */
  readonly getInheritanceChain: (nominal: string) => readonly string[];
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
 * Build a NominalEnv from a TypeRegistry.
 *
 * @param registry The TypeRegistry to use for lookups
 * @param convertType Function to convert TypeNode to IrType
 * @param binding Binding layer for symbol resolution (not type inference)
 */
export const buildNominalEnv = (
  registry: TypeRegistry,
  convertType: ConvertTypeFn,
  binding: Binding
): NominalEnv => {
  // Cache for computed inheritance chains
  const inheritanceChainCache = new Map<string, readonly string[]>();

  // Cache for computed instantiations
  // Key format: "receiverNominal|arg1,arg2,...|targetNominal"
  const instantiationCache = new Map<string, InstantiationEnv>();

  /**
   * Get the inheritance chain for a nominal type.
   * Returns types in order from child to parent.
   */
  const getInheritanceChain = (nominal: string): readonly string[] => {
    const cached = inheritanceChainCache.get(nominal);
    if (cached) return cached;

    const chain: string[] = [nominal];
    const visited = new Set<string>();
    visited.add(nominal);

    const walkHeritage = (typeName: string): void => {
      const entry = registry.resolveNominal(typeName);
      if (!entry) return;

      for (const heritage of entry.heritage) {
        if (heritage.kind === "extends" && !visited.has(heritage.typeName)) {
          visited.add(heritage.typeName);
          chain.push(heritage.typeName);
          walkHeritage(heritage.typeName);
        }
      }
    };

    walkHeritage(nominal);
    inheritanceChainCache.set(nominal, chain);
    return chain;
  };

  /**
   * Build substitution map for a specific step in the inheritance chain.
   * Maps the base type's type parameters to the concrete types from the heritage clause.
   *
   * NOTE: Uses legacy API (getHeritageTypeNodes) for backwards compatibility.
   * This will be updated in Step 7 to use pure IR HeritageInfo.
   */
  const buildStepSubstitution = (
    childEntry: ReturnType<TypeRegistry["resolveNominal"]>,
    baseTypeName: string,
    parentSubst: InstantiationEnv
  ): InstantiationEnv => {
    if (!childEntry) return new Map();

    // Use legacy API to get heritage clauses with TypeNodes
    const legacyHeritage = registry.getHeritageTypeNodes(
      childEntry.fullyQualifiedName
    );
    const heritageClause = legacyHeritage.find(
      (h) => h.typeName === baseTypeName
    );
    if (!heritageClause) return new Map();

    // Get the base type's legacy entry to find its type parameters (as strings)
    const baseLegacyEntry = registry.getLegacyEntry(baseTypeName);
    if (!baseLegacyEntry) return new Map();

    // Extract type arguments from heritage clause
    const typeNode = heritageClause.typeNode;
    const typeArgs: ts.TypeNode[] = [];

    if (ts.isExpressionWithTypeArguments(typeNode) && typeNode.typeArguments) {
      typeArgs.push(...typeNode.typeArguments);
    } else if (ts.isTypeReferenceNode(typeNode) && typeNode.typeArguments) {
      typeArgs.push(...typeNode.typeArguments);
    }

    // Build substitution map: base type param → concrete type
    const subst = new Map<string, IrType>();
    for (let i = 0; i < baseLegacyEntry.typeParameters.length; i++) {
      const paramName = baseLegacyEntry.typeParameters[i];
      const argNode = typeArgs[i];
      if (paramName && argNode) {
        // Convert the type argument to IR
        const argType = convertType(argNode, binding);
        // Apply parent substitution (in case the arg contains type params from child)
        const substitutedArgType = substituteIrType(argType, parentSubst);
        subst.set(paramName, substitutedArgType);
      }
    }

    return subst;
  };

  /**
   * Get instantiation for a specific target in the inheritance chain.
   *
   * NOTE: Uses legacy API (getLegacyEntry) for backwards compatibility.
   * This will be updated in Step 7 to use pure IR TypeParameterEntry.
   */
  const getInstantiation = (
    receiverNominal: string,
    receiverTypeArgs: readonly IrType[],
    targetNominal: string
  ): InstantiationEnv | undefined => {
    // Check cache
    const cacheKey = `${receiverNominal}|${receiverTypeArgs.map((a) => JSON.stringify(a)).join(",")}|${targetNominal}`;
    const cached = instantiationCache.get(cacheKey);
    if (cached) return cached;

    // If receiver is the target, build initial substitution from receiver's type args
    if (receiverNominal === targetNominal) {
      // Use legacy entry to get type parameters as strings
      const legacyEntry = registry.getLegacyEntry(receiverNominal);
      if (!legacyEntry) return undefined;

      const subst = new Map<string, IrType>();
      for (let i = 0; i < legacyEntry.typeParameters.length; i++) {
        const paramName = legacyEntry.typeParameters[i];
        const arg = receiverTypeArgs[i];
        if (paramName && arg) {
          subst.set(paramName, arg);
        }
      }
      instantiationCache.set(cacheKey, subst);
      return subst;
    }

    // Get inheritance chain
    const chain = getInheritanceChain(receiverNominal);

    // Check if target is in the chain
    const targetIndex = chain.indexOf(targetNominal);
    if (targetIndex === -1) return undefined;

    // Build substitution by walking the chain
    // Start with receiver's type args
    // Use legacy entry to get type parameters as strings
    const receiverLegacyEntry = registry.getLegacyEntry(receiverNominal);
    if (!receiverLegacyEntry) return undefined;

    let currentSubst = new Map<string, IrType>();
    for (let i = 0; i < receiverLegacyEntry.typeParameters.length; i++) {
      const paramName = receiverLegacyEntry.typeParameters[i];
      const arg = receiverTypeArgs[i];
      if (paramName && arg) {
        currentSubst.set(paramName, arg);
      }
    }

    // Walk from receiver to target, accumulating substitutions
    for (let i = 0; i < targetIndex; i++) {
      const childName = chain[i];
      const baseName = chain[i + 1];
      if (!childName || !baseName) continue;

      const childEntry = registry.resolveNominal(childName);
      const stepSubst = buildStepSubstitution(
        childEntry,
        baseName,
        currentSubst
      );

      // Merge step substitution into current
      // The step substitution maps base's params to concrete types
      currentSubst = new Map(stepSubst);
    }

    instantiationCache.set(cacheKey, currentSubst);
    return currentSubst;
  };

  /**
   * Find which type in the inheritance chain declares a given member.
   */
  const findMemberDeclaringType = (
    receiverNominal: string,
    receiverTypeArgs: readonly IrType[],
    memberName: string
  ): SubstitutionResult | undefined => {
    const chain = getInheritanceChain(receiverNominal);

    for (const typeName of chain) {
      const entry = registry.resolveNominal(typeName);
      if (!entry) continue;

      if (entry.members.has(memberName)) {
        const subst = getInstantiation(
          receiverNominal,
          receiverTypeArgs,
          typeName
        );
        if (subst) {
          return {
            targetNominal: typeName,
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
