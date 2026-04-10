/**
 * IR Type Substitution -- Substitution Application and Map Builders
 *
 * Provides substituteIrType for applying substitutions, and builder
 * functions for constructing substitution maps from receivers,
 * explicit type args, and call arguments.
 */

import type { IrType } from "./ir-types.js";
import { normalizedUnionType, runtimeUnionCarrierFamilyKey } from "./type-ops.js";
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

  const cache = new Map<IrType, IrType>();

  const substitute = (currentType: IrType): IrType => {
    const cached = cache.get(currentType);
    if (cached) {
      return cached;
    }

    switch (currentType.kind) {
      case "typeParameterType": {
        const substituted = substitutions.get(currentType.name);
        return substituted ?? currentType;
      }

      case "referenceType": {
        if (
          (!currentType.typeArguments || currentType.typeArguments.length === 0) &&
          (!currentType.structuralMembers ||
            currentType.structuralMembers.length === 0)
        ) {
          const substituted = substitutions.get(currentType.name);
          return substituted ?? currentType;
        }

        const draft = { ...currentType } as Extract<
          IrType,
          { kind: "referenceType" }
        >;
        cache.set(currentType, draft);

        const newArgs = currentType.typeArguments?.map((arg) =>
          substitute(arg)
        );
        const newStructuralMembers = currentType.structuralMembers?.map(
          (member) => {
            if (member.kind === "propertySignature") {
              return {
                ...member,
                type: substitute(member.type),
              };
            }

            return {
              ...member,
              returnType: member.returnType
                ? substitute(member.returnType)
                : member.returnType,
              parameters: member.parameters.map((parameter) =>
                parameter.type
                  ? {
                      ...parameter,
                      type: substitute(parameter.type),
                    }
                  : parameter
              ),
            };
          }
        );

        (draft as { typeArguments?: readonly IrType[] }).typeArguments = newArgs;
        if (newStructuralMembers !== undefined) {
          (
            draft as {
              structuralMembers?: NonNullable<
                Extract<IrType, { kind: "referenceType" }>["structuralMembers"]
              >;
            }
          ).structuralMembers = newStructuralMembers;
        }
        return draft;
      }

      case "arrayType": {
        const draft = { ...currentType } as Extract<
          IrType,
          { kind: "arrayType" }
        >;
        cache.set(currentType, draft);
        (
          draft as {
            elementType: IrType;
            tuplePrefixElementTypes?: readonly IrType[];
            tupleRestElementType?: IrType;
          }
        ).elementType = substitute(currentType.elementType);
        if (currentType.tuplePrefixElementTypes) {
          (
            draft as {
              tuplePrefixElementTypes?: readonly IrType[];
            }
          ).tuplePrefixElementTypes = currentType.tuplePrefixElementTypes.map(
            (elementType) => substitute(elementType)
          );
        }
        if (currentType.tupleRestElementType) {
          (
            draft as {
              tupleRestElementType?: IrType;
            }
          ).tupleRestElementType = substitute(currentType.tupleRestElementType);
        }
        return draft;
      }

      case "tupleType": {
        const draft = { ...currentType } as Extract<
          IrType,
          { kind: "tupleType" }
        >;
        cache.set(currentType, draft);
        (
          draft as { elementTypes: readonly IrType[] }
        ).elementTypes = currentType.elementTypes.map((elementType) =>
          substitute(elementType)
        );
        return draft;
      }

      case "unionType": {
        const draft = { ...currentType } as Extract<
          IrType,
          { kind: "unionType" }
        >;
        cache.set(currentType, draft);
        const substitutedMembers = currentType.types.map((memberType) =>
          substitute(memberType)
        );
        const preservedFamilyKey =
          currentType.runtimeCarrierFamilyKey ??
          runtimeUnionCarrierFamilyKey(currentType);
        if (currentType.preserveRuntimeLayout) {
          (
            draft as {
              types: readonly IrType[];
              runtimeCarrierFamilyKey?: string;
            }
          ).types = substitutedMembers;
          (
            draft as {
              runtimeCarrierFamilyKey?: string;
            }
          ).runtimeCarrierFamilyKey = preservedFamilyKey;
          return draft;
        }
        const normalized = normalizedUnionType(substitutedMembers, {
          runtimeCarrierFamilyKey: preservedFamilyKey,
        });
        cache.set(currentType, normalized);
        return normalized;
      }

      case "intersectionType": {
        const draft = { ...currentType } as Extract<
          IrType,
          { kind: "intersectionType" }
        >;
        cache.set(currentType, draft);
        (draft as { types: readonly IrType[] }).types = currentType.types.map(
          (memberType) => substitute(memberType)
        );
        return draft;
      }

      case "dictionaryType": {
        const draft = { ...currentType } as Extract<
          IrType,
          { kind: "dictionaryType" }
        >;
        cache.set(currentType, draft);
        (
          draft as {
            keyType: IrType;
            valueType: IrType;
          }
        ).keyType = substitute(currentType.keyType);
        (
          draft as {
            valueType: IrType;
          }
        ).valueType = substitute(currentType.valueType);
        return draft;
      }

      case "functionType": {
        const draft = { ...currentType } as Extract<
          IrType,
          { kind: "functionType" }
        >;
        cache.set(currentType, draft);
        (
          draft as {
            returnType: IrType;
            parameters: typeof currentType.parameters;
          }
        ).returnType = substitute(currentType.returnType);
        (
          draft as {
            parameters: typeof currentType.parameters;
          }
        ).parameters = currentType.parameters.map((parameter) =>
          parameter.type
            ? {
                ...parameter,
                type: substitute(parameter.type),
              }
            : parameter
        );
        return draft;
      }

      case "objectType": {
        const draft = { ...currentType } as Extract<
          IrType,
          { kind: "objectType" }
        >;
        cache.set(currentType, draft);
        (draft as { members: typeof currentType.members }).members =
          currentType.members.map((member) => {
            if (member.kind === "propertySignature") {
              return {
                ...member,
                type: substitute(member.type),
              };
            }
            return {
              ...member,
              returnType: member.returnType
                ? substitute(member.returnType)
                : member.returnType,
              parameters: member.parameters.map((parameter) =>
                parameter.type
                  ? {
                      ...parameter,
                      type: substitute(parameter.type),
                    }
                  : parameter
              ),
            };
          });
        return draft;
      }

      case "primitiveType":
      case "literalType":
      case "anyType":
      case "unknownType":
      case "voidType":
      case "neverType":
        return currentType;
    }
  };

  return substitute(type);
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
