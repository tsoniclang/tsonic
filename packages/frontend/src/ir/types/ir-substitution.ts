/**
 * IR Type Substitution Module
 *
 * Provides deterministic type substitution at the IR level.
 * This replaces TypeNode-based substitution with pure IR operations,
 * ensuring CLR type aliases are preserved through generic instantiation.
 *
 * Key functions:
 * - containsTypeParameter: Check if a type contains any type parameters
 * - unify: Match formal type parameters with actual types
 * - substituteIrType: Apply type parameter substitutions
 */

import type { IrType } from "./ir-types.js";

/**
 * Check if an IrType contains any type parameters (typeParameterType).
 *
 * Used to determine if a type needs substitution.
 * For example:
 * - `int` → false (no type parameters)
 * - `T` → true (is a type parameter)
 * - `List<T>` → true (contains type parameter)
 * - `List<int>` → false (fully instantiated)
 */
export const containsTypeParameter = (type: IrType): boolean => {
  switch (type.kind) {
    case "typeParameterType":
      return true;

    case "referenceType":
      return (
        type.typeArguments?.some((arg) => containsTypeParameter(arg)) ?? false
      );

    case "arrayType":
      return containsTypeParameter(type.elementType);

    case "tupleType":
      return type.elementTypes.some((el) => containsTypeParameter(el));

    case "functionType":
      return (
        containsTypeParameter(type.returnType) ||
        type.parameters.some((p) => p.type && containsTypeParameter(p.type))
      );

    case "unionType":
    case "intersectionType":
      return type.types.some((t) => containsTypeParameter(t));

    case "dictionaryType":
      return (
        containsTypeParameter(type.keyType) ||
        containsTypeParameter(type.valueType)
      );

    case "objectType":
      return type.members.some((m) => {
        if (m.kind === "propertySignature") {
          return containsTypeParameter(m.type);
        }
        if (m.kind === "methodSignature") {
          return (
            (m.returnType && containsTypeParameter(m.returnType)) ||
            m.parameters.some(
              (p: { type?: IrType }) => p.type && containsTypeParameter(p.type)
            )
          );
        }
        return false;
      });

    // Primitive types never contain type parameters
    case "primitiveType":
    case "literalType":
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return false;
  }
};

/**
 * Type substitution map: type parameter name → concrete IrType
 */
export type TypeSubstitutionMap = ReadonlyMap<string, IrType>;

/**
 * Result of substitution building - either success with map, or conflict error.
 * Conflicts occur when the same type parameter binds to different types.
 */
export type SubstitutionResult =
  | { readonly ok: true; readonly map: TypeSubstitutionMap }
  | {
      readonly ok: false;
      readonly conflict: {
        readonly param: string;
        readonly type1: IrType;
        readonly type2: IrType;
      };
    };

/**
 * Unify a formal type (with type parameters) against an actual type (instantiated).
 *
 * Returns a substitution map if unification succeeds, undefined if it fails.
 *
 * Examples:
 * - unify(T, int) → { "T" → int }
 * - unify(List<T>, List<int>) → { "T" → int }
 * - unify(Map<K, V>, Map<string, int>) → { "K" → string, "V" → int }
 * - unify(int, string) → undefined (no type parameters to match)
 *
 * The unification is one-way: we're matching the formal type's shape against
 * the actual type and extracting bindings for type parameters found in formal.
 */
export const unify = (
  formal: IrType,
  actual: IrType
): TypeSubstitutionMap | undefined => {
  const bindings = new Map<string, IrType>();

  const unifyRecursive = (f: IrType, a: IrType): boolean => {
    // If formal is a type parameter, bind it to actual
    if (f.kind === "typeParameterType") {
      const existing = bindings.get(f.name);
      if (existing) {
        // Already bound - check consistency
        return typesEqual(existing, a);
      }
      bindings.set(f.name, a);
      return true;
    }

    // If kinds don't match, unification fails
    if (f.kind !== a.kind) {
      return false;
    }

    // Match by kind
    switch (f.kind) {
      case "primitiveType":
        return a.kind === "primitiveType" && f.name === a.name;

      case "referenceType": {
        if (a.kind !== "referenceType") return false;
        if (f.name !== a.name) return false;

        const fArgs = f.typeArguments ?? [];
        const aArgs = a.typeArguments ?? [];
        if (fArgs.length !== aArgs.length) return false;

        for (let i = 0; i < fArgs.length; i++) {
          const fArg = fArgs[i];
          const aArg = aArgs[i];
          if (!fArg || !aArg) return false;
          if (!unifyRecursive(fArg, aArg)) return false;
        }
        return true;
      }

      case "arrayType":
        return (
          a.kind === "arrayType" && unifyRecursive(f.elementType, a.elementType)
        );

      case "tupleType": {
        if (a.kind !== "tupleType") return false;
        if (f.elementTypes.length !== a.elementTypes.length) return false;
        for (let i = 0; i < f.elementTypes.length; i++) {
          const fEl = f.elementTypes[i];
          const aEl = a.elementTypes[i];
          if (!fEl || !aEl) return false;
          if (!unifyRecursive(fEl, aEl)) return false;
        }
        return true;
      }

      case "unionType":
      case "intersectionType": {
        // DETERMINISTIC TYPING: Cannot infer type parameters through unions/intersections.
        // This makes inference non-deterministic (TS-like complexity).
        // If formal contains type parameters in a union/intersection, fail inference.
        if (containsTypeParameter(f)) {
          return false; // Caller should emit TSN5202
        }
        // If no type parameters in formal, just check equality
        if (a.kind !== f.kind) return false;
        if (f.types.length !== a.types.length) return false;
        for (let i = 0; i < f.types.length; i++) {
          const fType = f.types[i];
          const aType = a.types[i];
          if (!fType || !aType) return false;
          if (!unifyRecursive(fType, aType)) return false;
        }
        return true;
      }

      case "dictionaryType":
        return (
          a.kind === "dictionaryType" &&
          unifyRecursive(f.keyType, a.keyType) &&
          unifyRecursive(f.valueType, a.valueType)
        );

      case "functionType": {
        if (a.kind !== "functionType") return false;
        if (f.parameters.length !== a.parameters.length) return false;
        for (let i = 0; i < f.parameters.length; i++) {
          const fParam = f.parameters[i];
          const aParam = a.parameters[i];
          if (!fParam || !aParam) return false;
          if (fParam.type && aParam.type) {
            if (!unifyRecursive(fParam.type, aParam.type)) return false;
          }
        }
        return unifyRecursive(f.returnType, a.returnType);
      }

      // Literal types, any, unknown, void, never - just check equality
      case "literalType":
        return a.kind === "literalType" && f.value === a.value;

      case "anyType":
      case "unknownType":
      case "voidType":
      case "neverType":
        return true; // Kind already matched

      case "objectType":
        // Object types are structural - for now, don't try to unify
        // This is a conservative approach; could be enhanced if needed
        return false;
    }
  };

  const success = unifyRecursive(formal, actual);
  return success && bindings.size > 0 ? bindings : undefined;
};

/**
 * Check if two IrTypes are structurally equal.
 */
export const typesEqual = (a: IrType, b: IrType): boolean => {
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case "primitiveType":
      return b.kind === "primitiveType" && a.name === b.name;

    case "typeParameterType":
      return b.kind === "typeParameterType" && a.name === b.name;

    case "referenceType": {
      if (b.kind !== "referenceType") return false;
      if (a.name !== b.name) return false;
      const aArgs = a.typeArguments ?? [];
      const bArgs = b.typeArguments ?? [];
      if (aArgs.length !== bArgs.length) return false;
      for (let i = 0; i < aArgs.length; i++) {
        const aArg = aArgs[i];
        const bArg = bArgs[i];
        if (!aArg || !bArg || !typesEqual(aArg, bArg)) return false;
      }
      return true;
    }

    case "arrayType":
      return b.kind === "arrayType" && typesEqual(a.elementType, b.elementType);

    case "tupleType": {
      if (b.kind !== "tupleType") return false;
      if (a.elementTypes.length !== b.elementTypes.length) return false;
      for (let i = 0; i < a.elementTypes.length; i++) {
        const aEl = a.elementTypes[i];
        const bEl = b.elementTypes[i];
        if (!aEl || !bEl || !typesEqual(aEl, bEl)) return false;
      }
      return true;
    }

    case "unionType":
    case "intersectionType": {
      if (b.kind !== a.kind) return false;
      if (a.types.length !== b.types.length) return false;
      for (let i = 0; i < a.types.length; i++) {
        const aType = a.types[i];
        const bType = b.types[i];
        if (!aType || !bType || !typesEqual(aType, bType)) return false;
      }
      return true;
    }

    case "literalType":
      return b.kind === "literalType" && a.value === b.value;

    case "dictionaryType":
      return (
        b.kind === "dictionaryType" &&
        typesEqual(a.keyType, b.keyType) &&
        typesEqual(a.valueType, b.valueType)
      );

    case "functionType": {
      if (b.kind !== "functionType") return false;
      if (a.parameters.length !== b.parameters.length) return false;
      for (let i = 0; i < a.parameters.length; i++) {
        const aParam = a.parameters[i];
        const bParam = b.parameters[i];
        if (!aParam || !bParam) return false;
        if (aParam.type && bParam.type && !typesEqual(aParam.type, bParam.type))
          return false;
      }
      return typesEqual(a.returnType, b.returnType);
    }

    case "objectType":
      // Structural comparison for object types - simplified
      return false;

    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return true;
  }
};

/**
 * Apply type parameter substitutions to an IrType.
 *
 * Given a type with type parameters and a substitution map,
 * returns a new type with all type parameters replaced.
 *
 * Examples:
 * - substituteIrType(T, { "T" → int }) → int
 * - substituteIrType(List<T>, { "T" → int }) → List<int>
 * - substituteIrType(T | null, { "T" → int }) → int | null
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
        return substituted ?? type;
      }
      const newArgs = type.typeArguments.map((arg) =>
        substituteIrType(arg, substitutions)
      );
      // Check if any args changed
      const changed = newArgs.some((newArg, i) => {
        const origArg = type.typeArguments?.[i];
        return origArg ? newArg !== origArg : false;
      });
      if (!changed) return type;
      return {
        ...type,
        typeArguments: newArgs,
      };
    }

    case "arrayType": {
      const newElementType = substituteIrType(type.elementType, substitutions);
      if (newElementType === type.elementType) return type;
      return {
        ...type,
        elementType: newElementType,
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

    case "unionType":
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
 * returns { "T" → int }.
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
 * returns { "T" → int }.
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
 * returns { "T" → int }.
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
 * 1. Explicit call type arguments (e.g., `identity<int>(x)` → T=int)
 * 2. Argument-driven unification (e.g., `identity(a:int)` → T=int)
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
