/**
 * TypeSystem Relations — Substitution, Instantiation, Assignability, Equality
 *
 * Pure type-level operations that don't require call resolution or inference.
 *
 * DAG position: depends on type-system-state only
 */

import type { IrType, IrReferenceType } from "../types/index.js";
import {
  substituteIrType as irSubstitute,
  TypeSubstitutionMap as IrSubstitutionMap,
} from "../types/ir-substitution.js";
import {
  irTypesEqual as compareIrTypes,
  stableIrTypeKey,
} from "../types/type-ops.js";
import { unknownType } from "./types.js";
import type {
  TypeSystemState,
  TypeSubstitutionMap,
  Site,
} from "./type-system-state.js";
import {
  emitDiagnostic,
  isNullishPrimitive,
  normalizeToNominal,
  resolveTypeIdByName,
} from "./type-system-state.js";

// ─────────────────────────────────────────────────────────────────────────
// substitute — Delegate to ir-substitution
// ─────────────────────────────────────────────────────────────────────────

export const substitute = (
  type: IrType,
  subst: TypeSubstitutionMap
): IrType => {
  // Convert TypeSubstitutionMap to IrSubstitutionMap if needed
  // (they're the same type, just different naming)
  return irSubstitute(type, subst as IrSubstitutionMap);
};

// ─────────────────────────────────────────────────────────────────────────
// instantiate — Instantiate a generic type with type arguments
// ─────────────────────────────────────────────────────────────────────────

export const instantiate = (
  state: TypeSystemState,
  typeName: string,
  typeArgs: readonly IrType[],
  site?: Site
): IrType => {
  // Look up the type in registry
  const fqName = state.typeRegistry.getFQName(typeName);
  const entry = fqName
    ? state.typeRegistry.resolveNominal(fqName)
    : state.typeRegistry.resolveBySimpleName(typeName);

  if (!entry) {
    emitDiagnostic(state, "TSN5203", `Cannot resolve type '${typeName}'`, site);
    return unknownType;
  }

  // Build substitution map from type parameters to arguments
  const subst = new Map<string, IrType>();
  const typeParams = entry.typeParameters;
  for (let i = 0; i < Math.min(typeParams.length, typeArgs.length); i++) {
    const param = typeParams[i];
    const arg = typeArgs[i];
    if (param && arg) {
      subst.set(param.name, arg);
    }
  }

  // Return instantiated reference type
  const result: IrReferenceType = {
    kind: "referenceType",
    name: entry.name,
    typeArguments: typeArgs.length > 0 ? [...typeArgs] : undefined,
  };

  return result;
};

// ─────────────────────────────────────────────────────────────────────────
// isAssignableTo — Conservative subtype check
// ─────────────────────────────────────────────────────────────────────────

const resolveAliasExpansion = (
  state: TypeSystemState,
  type: IrType
): 
  | {
      readonly key: string;
      readonly expanded: IrType;
    }
  | undefined => {
  if (type.kind !== "referenceType") {
    return undefined;
  }

  const typeId =
    type.typeId ??
    resolveTypeIdByName(
      state,
      type.resolvedClrType ?? type.name,
      type.typeArguments?.length ?? 0
    );
  if (!typeId) {
    return undefined;
  }

  const entry = state.unifiedCatalog.getByTypeId(typeId);
  if (!entry?.aliasedType) {
    return undefined;
  }

  let expanded = entry.aliasedType;
  if (
    entry.typeParameters.length > 0 &&
    (type.typeArguments?.length ?? 0) > 0
  ) {
    const subst = new Map<string, IrType>();
    for (
      let index = 0;
      index < Math.min(entry.typeParameters.length, type.typeArguments?.length ?? 0);
      index += 1
    ) {
      const typeParameter = entry.typeParameters[index];
      const typeArgument = type.typeArguments?.[index];
      if (typeParameter && typeArgument) {
        subst.set(typeParameter.name, typeArgument);
      }
    }
    if (subst.size > 0) {
      expanded = irSubstitute(expanded, subst as IrSubstitutionMap);
    }
  }

  return {
    key: `${typeId.stableId}<${(type.typeArguments ?? [])
      .map((arg) => stableIrTypeKey(arg))
      .join(",")}>`,
    expanded,
  };
};

const isAssignableToInternal = (
  state: TypeSystemState,
  source: IrType,
  target: IrType,
  activeAliases: ReadonlySet<string>
): boolean => {
  // Same type - always assignable
  if (typesEqual(source, target)) return true;

  // any is assignable to anything, anything is assignable to any
  if (source.kind === "anyType" || target.kind === "anyType") return true;

  // never is assignable to anything
  if (source.kind === "neverType") return true;

  // undefined/null assignability (represented as primitiveType with name "null"/"undefined")
  if (isNullishPrimitive(source)) {
    // Assignable to union containing undefined/null
    if (target.kind === "unionType") {
      return target.types.some(
        (t) => t.kind === "primitiveType" && t.name === source.name
      );
    }
    return false;
  }

  const sourceAlias = resolveAliasExpansion(state, source);
  if (sourceAlias && !activeAliases.has(sourceAlias.key)) {
    const nextActiveAliases = new Set(activeAliases);
    nextActiveAliases.add(sourceAlias.key);
    return isAssignableToInternal(
      state,
      sourceAlias.expanded,
      target,
      nextActiveAliases
    );
  }

  const targetAlias = resolveAliasExpansion(state, target);
  if (targetAlias && !activeAliases.has(targetAlias.key)) {
    const nextActiveAliases = new Set(activeAliases);
    nextActiveAliases.add(targetAlias.key);
    return isAssignableToInternal(
      state,
      source,
      targetAlias.expanded,
      nextActiveAliases
    );
  }

  // Primitives - same primitive type
  if (source.kind === "primitiveType" && target.kind === "primitiveType") {
    return source.name === target.name;
  }

  // Union source - all members must be assignable
  if (source.kind === "unionType") {
    return source.types.every((t) =>
      isAssignableToInternal(state, t, target, activeAliases)
    );
  }

  // Union target - source must be assignable to at least one member
  if (target.kind === "unionType") {
    return target.types.some((t) =>
      isAssignableToInternal(state, source, t, activeAliases)
    );
  }

  // Array types
  if (source.kind === "arrayType" && target.kind === "arrayType") {
    return isAssignableToInternal(
      state,
      source.elementType,
      target.elementType,
      activeAliases
    );
  }

  // Reference types - check nominal compatibility via TypeId
  if (source.kind === "referenceType" && target.kind === "referenceType") {
    const sourceNominal = normalizeToNominal(state, source);
    const targetNominal = normalizeToNominal(state, target);
    if (!sourceNominal || !targetNominal) return false;

    if (sourceNominal.typeId.stableId === targetNominal.typeId.stableId) {
      const sourceArgs = sourceNominal.typeArgs;
      const targetArgs = targetNominal.typeArgs;
      if (sourceArgs.length !== targetArgs.length) return false;
      return sourceArgs.every((sa, i) => {
        const ta = targetArgs[i];
        return ta ? typesEqual(sa, ta) : false;
      });
    }

    const chain = state.nominalEnv.getInheritanceChain(sourceNominal.typeId);
    return chain.some((t) => t.stableId === targetNominal.typeId.stableId);
  }

  // Conservative - return false if unsure
  return false;
};

export const isAssignableTo = (
  state: TypeSystemState,
  source: IrType,
  target: IrType
): boolean => isAssignableToInternal(state, source, target, new Set());

// ─────────────────────────────────────────────────────────────────────────
// typesEqual — Structural equality check
// ─────────────────────────────────────────────────────────────────────────

export const typesEqual = (a: IrType, b: IrType): boolean =>
  compareIrTypes(a, b);

// ─────────────────────────────────────────────────────────────────────────
// containsTypeParameter — Check if type contains unresolved type params
// ─────────────────────────────────────────────────────────────────────────

export const containsTypeParameter = (type: IrType): boolean => {
  if (type.kind === "typeParameterType") return true;
  if (type.kind === "referenceType") {
    return (type.typeArguments ?? []).some(containsTypeParameter);
  }
  if (type.kind === "arrayType") {
    return containsTypeParameter(type.elementType);
  }
  if (type.kind === "functionType") {
    const paramsContain = type.parameters.some(
      (p) => p.type && containsTypeParameter(p.type)
    );
    const returnContains =
      type.returnType && containsTypeParameter(type.returnType);
    return paramsContain || !!returnContains;
  }
  if (type.kind === "unionType" || type.kind === "intersectionType") {
    return type.types.some(containsTypeParameter);
  }
  if (type.kind === "tupleType") {
    return type.elementTypes.some(containsTypeParameter);
  }
  if (type.kind === "objectType") {
    return type.members.some((m) => {
      if (m.kind === "propertySignature") {
        return containsTypeParameter(m.type);
      }
      if (m.kind === "methodSignature") {
        const paramsContain = m.parameters.some(
          (p) => p.type && containsTypeParameter(p.type)
        );
        const returnContains =
          m.returnType && containsTypeParameter(m.returnType);
        return paramsContain || !!returnContains;
      }
      return false;
    });
  }
  return false;
};
