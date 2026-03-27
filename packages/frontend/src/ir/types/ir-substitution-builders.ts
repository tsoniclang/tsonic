/**
 * IR Type Substitution -- Substitution Application and Map Builders
 *
 * Provides substituteIrType for applying substitutions, and builder
 * functions for constructing substitution maps from receivers,
 * explicit type args, and call arguments.
 */

import type { IrType } from "./ir-types.js";
import { normalizedUnionType } from "./type-ops.js";
import {
  type TypeSubstitutionMap,
  type SubstitutionResult,
  containsTypeParameter,
  unify,
  typesEqual,
} from "./ir-substitution-core.js";

/**
 * Apply type parameter substitutions to an IrType.
 *
 * Given a type with type parameters and a substitution map,
 * returns a new type with all type parameters replaced.
 *
 * Examples:
 * - substituteIrType(T, { "T" -> int }) -> int
 * - substituteIrType(List<T>, { "T" -> int }) -> List<int>
 * - substituteIrType(T | null, { "T" -> int }) -> int | null
 *
 * If no substitutions apply, returns the original type unchanged.
 */
export const substituteIrType = (
  type: IrType,
  substitutions: TypeSubstitutionMap
): IrType => {
  if (substitutions.size === 0) return type;

  switch (type.kind) {
    case "typeParameterType": {
      const substituted = substitutions.get(type.name);
      return substituted ?? type;
    }

    case "referenceType": {
      // Some converter paths represent bare type parameters as referenceType nodes.
      // If the type name matches a substitution key and has no type arguments,
      // treat it as a bare type parameter (e.g., TEntity) and substitute directly.
      if (!type.typeArguments || type.typeArguments.length === 0) {
        const substituted = substitutions.get(type.name);
        if (substituted) {
          return substituted;
        }
        if (!type.structuralMembers || type.structuralMembers.length === 0) {
          return type;
        }
      }
      const newArgs = type.typeArguments?.map((arg) =>
        substituteIrType(arg, substitutions)
      );
      const newStructuralMembers = type.structuralMembers?.map((member) => {
        if (member.kind === "propertySignature") {
          const substitutedType = substituteIrType(member.type, substitutions);
          return substitutedType === member.type
            ? member
            : { ...member, type: substitutedType };
        }

        const substitutedReturnType = member.returnType
          ? substituteIrType(member.returnType, substitutions)
          : member.returnType;
        const substitutedParameters = member.parameters.map((parameter) =>
          parameter.type
            ? {
                ...parameter,
                type: substituteIrType(parameter.type, substitutions),
              }
            : parameter
        );

        const unchangedParameters = substitutedParameters.every(
          (parameter, index) => {
            const original = member.parameters[index];
            return original ? parameter.type === original.type : true;
          }
        );

        if (
          substitutedReturnType === member.returnType &&
          unchangedParameters
        ) {
          return member;
        }

        return {
          ...member,
          returnType: substitutedReturnType,
          parameters: substitutedParameters,
        };
      });
      const argsChanged =
        newArgs?.some((newArg, i) => {
          const origArg = type.typeArguments?.[i];
          return origArg ? newArg !== origArg : false;
        }) ?? false;
      const structuralChanged =
        newStructuralMembers?.some((member, i) => {
          const original = type.structuralMembers?.[i];
          return original ? member !== original : false;
        }) ?? false;
      if (!argsChanged && !structuralChanged) return type;
      return {
        ...type,
        typeArguments: newArgs,
        ...(newStructuralMembers
          ? { structuralMembers: newStructuralMembers }
          : {}),
      };
    }

    case "arrayType": {
      const newElementType = substituteIrType(type.elementType, substitutions);
      const newTuplePrefixElementTypes = type.tuplePrefixElementTypes?.map(
        (elementType) => substituteIrType(elementType, substitutions)
      );
      const newTupleRestElementType = type.tupleRestElementType
        ? substituteIrType(type.tupleRestElementType, substitutions)
        : undefined;
      const tuplePrefixChanged =
        newTuplePrefixElementTypes?.some(
          (elementType, index) =>
            elementType !== type.tuplePrefixElementTypes?.[index]
        ) ?? false;
      const tupleRestChanged =
        newTupleRestElementType !== type.tupleRestElementType;
      if (
        newElementType === type.elementType &&
        !tuplePrefixChanged &&
        !tupleRestChanged
      ) {
        return type;
      }
      return {
        ...type,
        elementType: newElementType,
        ...((newTuplePrefixElementTypes?.length ?? 0) > 0
          ? { tuplePrefixElementTypes: newTuplePrefixElementTypes }
          : {}),
        ...(newTupleRestElementType
          ? { tupleRestElementType: newTupleRestElementType }
          : {}),
      };
    }

    case "tupleType": {
      const newElements = type.elementTypes.map((el) =>
        substituteIrType(el, substitutions)
      );
      const changed = newElements.some((el, i) => el !== type.elementTypes[i]);
      if (!changed) return type;
      return {
        ...type,
        elementTypes: newElements,
      };
    }

    case "unionType": {
      const newTypes = type.types.map((t) =>
        substituteIrType(t, substitutions)
      );
      const changed = newTypes.some((t, i) => t !== type.types[i]);
      if (!changed) return type;
      return normalizedUnionType(newTypes);
    }

    case "intersectionType": {
      const newTypes = type.types.map((t) =>
        substituteIrType(t, substitutions)
      );
      const changed = newTypes.some((t, i) => t !== type.types[i]);
      if (!changed) return type;
      return {
        ...type,
        types: newTypes,
      };
    }

    case "dictionaryType": {
      const newKeyType = substituteIrType(type.keyType, substitutions);
      const newValueType = substituteIrType(type.valueType, substitutions);
      if (newKeyType === type.keyType && newValueType === type.valueType) {
        return type;
      }
      return {
        ...type,
        keyType: newKeyType,
        valueType: newValueType,
      };
    }

    case "functionType": {
      const newReturnType = substituteIrType(type.returnType, substitutions);
      const newParams = type.parameters.map((p) =>
        p.type ? { ...p, type: substituteIrType(p.type, substitutions) } : p
      );
      const returnChanged = newReturnType !== type.returnType;
      const paramsChanged = newParams.some((p, i) => {
        const orig = type.parameters[i];
        return orig ? p.type !== orig.type : false;
      });
      if (!returnChanged && !paramsChanged) return type;
      return {
        ...type,
        returnType: newReturnType,
        parameters: newParams,
      };
    }

    case "objectType": {
      // Substitute within object type members
      const newMembers = type.members.map((m) => {
        if (m.kind === "propertySignature") {
          const newType = substituteIrType(m.type, substitutions);
          if (newType === m.type) return m;
          return { ...m, type: newType };
        }
        if (m.kind === "methodSignature") {
          const newReturnType = m.returnType
            ? substituteIrType(m.returnType, substitutions)
            : m.returnType;
          const newParams = m.parameters.map((p) =>
            p.type ? { ...p, type: substituteIrType(p.type, substitutions) } : p
          );
          if (
            newReturnType === m.returnType &&
            newParams.every((p, i) => {
              const orig = m.parameters[i];
              return orig ? p.type === orig.type : true;
            })
          ) {
            return m;
          }
          return {
            ...m,
            returnType: newReturnType,
            parameters: newParams,
          };
        }
        return m;
      });
      const changed = newMembers.some((m, i) => m !== type.members[i]);
      if (!changed) return type;
      return {
        ...type,
        members: newMembers,
      };
    }

    // Types that don't contain type parameters - return unchanged
    case "primitiveType":
    case "literalType":
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return type;
  }
};

/**
 * Build IR substitution map from a receiver's type and the formal type parameters.
 *
 * Given a receiver like `list: List<int>` and a formal interface with type parameter T,
 * returns { "T" -> int }.
 *
 * This is the IR-level equivalent of buildTypeParameterSubstitutionMap from calls.ts,
 * but works entirely at the IR level without TS AST archaeology.
 */
export const buildIrSubstitutionMap = (
  receiverType: IrType,
  formalTypeParams: readonly string[]
): TypeSubstitutionMap | undefined => {
  if (receiverType.kind !== "referenceType") return undefined;

  const typeArgs = receiverType.typeArguments;
  if (!typeArgs || typeArgs.length !== formalTypeParams.length)
    return undefined;

  const map = new Map<string, IrType>();
  for (let i = 0; i < formalTypeParams.length; i++) {
    const paramName = formalTypeParams[i];
    const arg = typeArgs[i];
    if (paramName && arg) {
      map.set(paramName, arg);
    }
  }
  return map.size > 0 ? map : undefined;
};

/**
 * Build substitution map from explicit call type arguments.
 *
 * For a call like `identity<int>(x)` with formal type param `T`,
 * returns { "T" -> int }.
 *
 * This is binding source #2: explicit type arguments in the call.
 */
export const buildSubstitutionFromExplicitTypeArgs = (
  explicitTypeArgs: readonly IrType[],
  formalTypeParams: readonly string[]
): TypeSubstitutionMap | undefined => {
  if (explicitTypeArgs.length === 0) return undefined;
  if (explicitTypeArgs.length !== formalTypeParams.length) return undefined;

  const map = new Map<string, IrType>();
  for (let i = 0; i < formalTypeParams.length; i++) {
    const paramName = formalTypeParams[i];
    const arg = explicitTypeArgs[i];
    if (paramName && arg) {
      map.set(paramName, arg);
    }
  }
  return map.size > 0 ? map : undefined;
};

/**
 * Build substitution map from call arguments via bounded unification.
 *
 * For a call like `identity(a)` where `a: int` and formal param is `x: T`,
 * returns { "T" -> int }.
 *
 * This is binding source #3: argument-driven unification.
 * No body analysis - just matches argument types against parameter types.
 *
 * Returns SubstitutionResult to detect conflicts (TSN5202):
 * - If T binds to `int` from arg0 and `long` from arg1, returns conflict error
 */
export const buildSubstitutionFromArguments = (
  argTypes: readonly (IrType | undefined)[],
  formalParamTypes: readonly (IrType | undefined)[]
): SubstitutionResult => {
  const map = new Map<string, IrType>();

  for (let i = 0; i < Math.min(argTypes.length, formalParamTypes.length); i++) {
    const argType = argTypes[i];
    const paramType = formalParamTypes[i];

    if (!argType || !paramType) continue;

    // If param type contains type parameters, try to unify
    if (containsTypeParameter(paramType)) {
      const bindings = unify(paramType, argType);
      if (bindings) {
        // Merge bindings into map WITH CONFLICT DETECTION
        for (const [name, type] of bindings) {
          const existing = map.get(name);
          if (existing) {
            // Check for conflict: same type param bound to different types
            if (!typesEqual(existing, type)) {
              return {
                ok: false,
                conflict: { param: name, type1: existing, type2: type },
              };
            }
            // Same type - no conflict, skip
          } else {
            map.set(name, type);
          }
        }
      }
    }
  }

  return { ok: true, map };
};

/**
 * Complete substitution with separate maps for receiver and call type params.
 * This avoids name collisions between class type params (T in List<T>)
 * and method type params (T in Select<T>).
 */
export type CompleteSubstitution = {
  readonly receiverSubst: TypeSubstitutionMap;
  readonly callSubst: TypeSubstitutionMap;
};

/**
 * Result of building complete substitution - success or conflict error.
 */
export type CompleteSubstitutionResult =
  | { readonly ok: true; readonly substitution: CompleteSubstitution }
  | {
      readonly ok: false;
      readonly conflict: {
        readonly param: string;
        readonly type1: IrType;
        readonly type2: IrType;
      };
    };

/**
 * Build complete substitution map from all 3 binding sources.
 *
 * Keeps receiver and call substitutions SEPARATE to avoid name collisions.
 *
 * Priority order for call substitutions:
 * 1. Explicit call type arguments (e.g., `identity<int>(x)` -> T=int)
 * 2. Argument-driven unification (e.g., `identity(a:int)` -> T=int)
 *
 * Receiver substitutions are separate and used for instantiating member signatures.
 */
export const buildCompleteSubstitutionMap = (
  receiverType: IrType | undefined,
  receiverFormalTypeParams: readonly string[],
  explicitTypeArgs: readonly IrType[],
  callFormalTypeParams: readonly string[],
  argTypes: readonly (IrType | undefined)[],
  formalParamTypes: readonly (IrType | undefined)[]
): CompleteSubstitutionResult => {
  // Receiver substitution - for instantiating member signatures of the receiver type
  const receiverSubst: TypeSubstitutionMap = receiverType
    ? (buildIrSubstitutionMap(receiverType, receiverFormalTypeParams) ??
      new Map())
    : new Map();

  // Call substitution - for method type params
  const callSubst = new Map<string, IrType>();

  // Source 1: Explicit call type arguments (highest priority for call)
  const explicitSubs = buildSubstitutionFromExplicitTypeArgs(
    explicitTypeArgs,
    callFormalTypeParams
  );
  if (explicitSubs) {
    for (const [name, type] of explicitSubs) {
      callSubst.set(name, type);
    }
  }

  // Source 2: Argument-driven unification (lowest priority, for ergonomics)
  const argSubsResult = buildSubstitutionFromArguments(
    argTypes,
    formalParamTypes
  );

  // Check for conflicts in argument-driven unification
  if (!argSubsResult.ok) {
    return {
      ok: false,
      conflict: argSubsResult.conflict,
    };
  }

  // Merge argument subs (only for type params not already bound)
  for (const [name, type] of argSubsResult.map) {
    if (!callSubst.has(name)) {
      callSubst.set(name, type);
    }
  }

  return {
    ok: true,
    substitution: { receiverSubst, callSubst },
  };
};
