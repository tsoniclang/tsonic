/**
 * TypeSystem Relations — Substitution, Instantiation, Assignability, Equality
 *
 * Pure type-level operations that don't require call resolution or inference.
 *
 * DAG position: depends on type-system-state only
 */

import type {
  IrInterfaceMember,
  IrReferenceType,
  IrType,
} from "../types/index.js";
import {
  substituteIrType as irSubstitute,
  TypeSubstitutionMap as IrSubstitutionMap,
} from "../types/ir-substitution.js";
import {
  createLocalTypeIdentityState,
  irTypesEqual as compareIrTypes,
  localTypeIdentityKey,
  type LocalTypeIdentityState,
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
import { getIterableShape } from "./iterable-type-shapes.js";
import { expandReferenceAlias } from "./type-alias-expansion.js";

const SOURCE_NUMERIC_ALIAS_NAMES = new Set([
  "byte",
  "sbyte",
  "short",
  "ushort",
  "int",
  "uint",
  "long",
  "ulong",
  "float",
  "double",
  "decimal",
]);

const SOURCE_PRIMITIVE_ALIAS_NAMES = new Set(["int", "char"]);

const aliasExpansionTypeArgKeyState = createLocalTypeIdentityState();

type AssignabilityContext = {
  readonly activeAliases: ReadonlySet<string>;
  readonly pairKeyState: LocalTypeIdentityState;
  readonly activePairs: Set<string>;
  readonly memo: Map<string, boolean>;
};

const createAssignabilityContext = (): AssignabilityContext => ({
  activeAliases: new Set<string>(),
  pairKeyState: createLocalTypeIdentityState(),
  activePairs: new Set<string>(),
  memo: new Map<string, boolean>(),
});

const withActiveAlias = (
  context: AssignabilityContext,
  aliasKey: string
): AssignabilityContext => {
  const activeAliases = new Set(context.activeAliases);
  activeAliases.add(aliasKey);
  return {
    ...context,
    activeAliases,
  };
};

const assignabilityPairKey = (
  source: IrType,
  target: IrType,
  context: AssignabilityContext
): string => {
  const sourceKey = localTypeIdentityKey(source, context.pairKeyState);
  const targetKey = localTypeIdentityKey(target, context.pairKeyState);
  const aliasKeys = [...context.activeAliases].sort().join("|");
  return `${sourceKey}=>${targetKey}#${aliasKeys}`;
};

const getPrimitiveAliasName = (type: IrType): "int" | "char" | undefined => {
  if (type.kind === "primitiveType") {
    return SOURCE_PRIMITIVE_ALIAS_NAMES.has(type.name)
      ? (type.name as "int" | "char")
      : undefined;
  }

  if (type.kind !== "referenceType") {
    return undefined;
  }

  const simpleName = type.name.split(".").pop() ?? type.name;
  if (simpleName === "int") {
    return "int";
  }
  if (simpleName === "char") {
    return "char";
  }

  return undefined;
};

const getNumericTypeName = (type: IrType): string | undefined => {
  if (type.kind === "primitiveType") {
    return type.name === "number" || SOURCE_NUMERIC_ALIAS_NAMES.has(type.name)
      ? type.name
      : undefined;
  }

  if (type.kind !== "referenceType") {
    return undefined;
  }

  const simpleName = type.name.split(".").pop() ?? type.name;
  return SOURCE_NUMERIC_ALIAS_NAMES.has(simpleName) ? simpleName : undefined;
};

const isNumericWideningAssignable = (
  source: IrType,
  target: IrType
): boolean => {
  const sourceName = getNumericTypeName(source);
  const targetName = getNumericTypeName(target);
  return (
    targetName === "number" &&
    sourceName !== undefined &&
    sourceName !== "number"
  );
};

const isArrayInstanceTarget = (type: IrType): boolean => {
  if (type.kind === "arrayType" || type.kind === "tupleType") {
    return true;
  }

  if (type.kind !== "referenceType") {
    return false;
  }

  const simpleName = type.name.split(".").pop() ?? type.name;
  const targetSimpleName = type.providerQualifiedName?.split(".").pop();
  return (
    simpleName === "Array" ||
    simpleName === "ReadonlyArray" ||
    targetSimpleName === "Array" ||
    targetSimpleName === "ReadonlyArray"
  );
};

const isArrayInstanceCandidate = (type: IrType): boolean => {
  if (type.kind === "arrayType" || type.kind === "tupleType") {
    return true;
  }

  if (type.kind !== "referenceType") {
    return false;
  }

  const simpleName = type.name.split(".").pop() ?? type.name;
  const targetSimpleName = type.providerQualifiedName?.split(".").pop();
  return (
    simpleName === "Array" ||
    simpleName === "ReadonlyArray" ||
    targetSimpleName === "Array" ||
    targetSimpleName === "ReadonlyArray"
  );
};

const isBroadObjectTargetType = (type: IrType): boolean => {
  if (type.kind !== "referenceType") {
    return false;
  }

  const simpleName = type.name.split(".").pop() ?? type.name;
  if (simpleName === "object") {
    return true;
  }

  return simpleName === "Object" || type.typeId?.sourceName === "Object";
};

const isAssignableToBroadObjectTarget = (
  state: TypeSystemState,
  source: IrType,
  activeAliases: ReadonlySet<string>
): boolean => {
  if (source.kind === "neverType") {
    return true;
  }

  if (source.kind === "anyType") {
    return true;
  }

  if (source.kind === "unknownType") {
    if (source.explicit === true) {
      return true;
    }
    return false;
  }

  const sourceAlias = resolveAliasExpansion(state, source);
  if (sourceAlias && !activeAliases.has(sourceAlias.key)) {
    const nextActiveAliases = new Set(activeAliases);
    nextActiveAliases.add(sourceAlias.key);
    return isAssignableToBroadObjectTarget(
      state,
      sourceAlias.expanded,
      nextActiveAliases
    );
  }

  if (source.kind === "unionType" || source.kind === "intersectionType") {
    return source.types.every((member) =>
      isAssignableToBroadObjectTarget(state, member, activeAliases)
    );
  }

  if (source.kind === "primitiveType") {
    return source.name !== "undefined";
  }

  if (source.kind === "voidType") {
    return false;
  }

  return true;
};

export const matchesInstanceofTarget = (
  state: TypeSystemState,
  source: IrType,
  target: IrType
): boolean => {
  if (typesEqual(source, target)) {
    return true;
  }

  if (target.kind === "unionType") {
    return target.types.some((candidate) =>
      matchesInstanceofTarget(state, source, candidate)
    );
  }

  if (source.kind === "unionType") {
    return source.types.every((candidate) =>
      matchesInstanceofTarget(state, candidate, target)
    );
  }

  if (isArrayInstanceTarget(target) && isArrayInstanceCandidate(source)) {
    return true;
  }

  if (source.kind === "referenceType" && target.kind === "referenceType") {
    const sourceNominal = normalizeToNominal(state, source);
    const targetNominal = normalizeToNominal(state, target);

    if (sourceNominal && targetNominal) {
      if (sourceNominal.typeId.stableId === targetNominal.typeId.stableId) {
        return true;
      }

      const chain = state.nominalEnv.getInheritanceChain(sourceNominal.typeId);
      return chain.some(
        (typeId) => typeId.stableId === targetNominal.typeId.stableId
      );
    }
  }

  return isAssignableTo(state, source, target);
};

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

  const expanded = expandReferenceAlias(state, type);
  if (!expanded) {
    return undefined;
  }

  const typeId =
    type.typeId ??
    resolveTypeIdByName(
      state,
      type.providerQualifiedName ?? type.name,
      type.typeArguments?.length ?? 0
    );
  if (!typeId) {
    return undefined;
  }

  const typeArgumentKeys = (type.typeArguments ?? []).map((arg) =>
    localTypeIdentityKey(arg, aliasExpansionTypeArgKeyState)
  );

  return {
    key: `${typeId.stableId}<${typeArgumentKeys.join(",")}>`,
    expanded,
  };
};

type ComparableMethodSignature = {
  readonly parameters: readonly {
    readonly type?: IrType;
  }[];
  readonly returnType?: IrType;
};

const resolveNominalMemberEntry = (
  state: TypeSystemState,
  source: IrReferenceType,
  memberName: string
):
  | {
      readonly memberType: IrType | undefined;
      readonly signatures: readonly ComparableMethodSignature[];
    }
  | undefined => {
  const normalized = normalizeToNominal(state, source);
  if (!normalized) {
    return undefined;
  }

  const lookupResult = state.nominalEnv.findMemberDeclaringType(
    normalized.typeId,
    normalized.typeArgs,
    memberName
  );
  if (!lookupResult) {
    return undefined;
  }

  const memberEntry = state.unifiedCatalog.getMember(
    lookupResult.declaringTypeId,
    memberName
  );
  if (!memberEntry) {
    return undefined;
  }

  const substituteMemberType = (
    type: IrType | undefined
  ): IrType | undefined =>
    type
      ? irSubstitute(type, lookupResult.substitution as IrSubstitutionMap)
      : undefined;

  return {
    memberType: substituteMemberType(memberEntry.type),
    signatures: (memberEntry.signatures ?? []).map((signature) => ({
      parameters: signature.parameters.map((parameter) => ({
        type: substituteMemberType(parameter.type),
      })),
      returnType: substituteMemberType(signature.returnType),
    })),
  };
};

const getStructuralMembers = (
  type: IrType
): readonly IrInterfaceMember[] | undefined => {
  if (type.kind === "objectType") {
    return type.members;
  }

  if (type.kind === "referenceType") {
    return type.structuralMembers;
  }

  return undefined;
};

const isStructurallyAssignable = (
  state: TypeSystemState,
  source: IrType,
  target: IrType,
  context: AssignabilityContext
): boolean | undefined => {
  const sourceMembers = getStructuralMembers(source) ?? [];
  const targetMembers = getStructuralMembers(target) ?? [];
  if (sourceMembers.length === 0 || targetMembers.length === 0) {
    return undefined;
  }

  return targetMembers.every((targetMember) => {
    if (targetMember.kind === "propertySignature") {
      const matches = sourceMembers.filter(
        (
          candidate
        ): candidate is Extract<
          typeof candidate,
          { readonly kind: "propertySignature" }
        > =>
          candidate.kind === "propertySignature" &&
          candidate.name === targetMember.name
      );
      if (matches.length === 1) {
        const match = matches[0];
        return (
          !!match &&
          isAssignableToInternal(state, match.type, targetMember.type, context)
        );
      }

      if (source.kind !== "referenceType") {
        return false;
      }

      const nominalMember = resolveNominalMemberEntry(
        state,
        source,
        targetMember.name
      );
      if (!nominalMember?.memberType) {
        return false;
      }

      return isAssignableToInternal(
        state,
        nominalMember.memberType,
        targetMember.type,
        context
      );
    }

    if (targetMember.kind === "methodSignature") {
      const matches = sourceMembers.filter(
        (
          candidate
        ): candidate is Extract<
          typeof candidate,
          { readonly kind: "methodSignature" }
        > =>
          candidate.kind === "methodSignature" &&
          candidate.name === targetMember.name &&
          candidate.parameters.length === targetMember.parameters.length
      );
      const comparableMatches: readonly ComparableMethodSignature[] =
        matches.length === 1
          ? matches
          : source.kind === "referenceType"
            ? (resolveNominalMemberEntry(
                state,
                source,
                targetMember.name
              )?.signatures.filter(
                (signature) =>
                  signature.parameters.length === targetMember.parameters.length
              ) ?? [])
            : [];

      if (comparableMatches.length !== 1) {
        return false;
      }

      const match = comparableMatches[0];
      if (!match) {
        return false;
      }

      for (
        let parameterIndex = 0;
        parameterIndex < targetMember.parameters.length;
        parameterIndex += 1
      ) {
        const sourceParameter = match.parameters[parameterIndex];
        const targetParameter = targetMember.parameters[parameterIndex];
        const sourceParameterType = sourceParameter?.type;
        const targetParameterType = targetParameter?.type;
        if (!sourceParameterType || !targetParameterType) {
          continue;
        }
        if (
          !isAssignableToInternal(
            state,
            targetParameterType,
            sourceParameterType,
            context
          )
        ) {
          return false;
        }
      }

      return isAssignableToInternal(
        state,
        match.returnType ?? unknownType,
        targetMember.returnType ?? unknownType,
        context
      );
    }

    return false;
  });
};

const isAssignableToInternal = (
  state: TypeSystemState,
  source: IrType,
  target: IrType,
  context: AssignabilityContext
): boolean => {
  const pairKey = assignabilityPairKey(source, target, context);
  const cached = context.memo.get(pairKey);
  if (cached !== undefined) {
    return cached;
  }

  if (context.activePairs.has(pairKey)) {
    return true;
  }

  context.activePairs.add(pairKey);
  let result: boolean;
  try {
    result = isAssignableToInternalUncached(state, source, target, context);
  } finally {
    context.activePairs.delete(pairKey);
  }

  context.memo.set(pairKey, result);
  return result;
};

const isAssignableToInternalUncached = (
  state: TypeSystemState,
  source: IrType,
  target: IrType,
  context: AssignabilityContext
): boolean => {
  // Same type - always assignable
  if (typesEqual(source, target)) return true;

  const sourcePrimitiveAlias = getPrimitiveAliasName(source);
  const targetPrimitiveAlias = getPrimitiveAliasName(target);
  if (
    sourcePrimitiveAlias &&
    targetPrimitiveAlias &&
    sourcePrimitiveAlias === targetPrimitiveAlias
  ) {
    return true;
  }

  if (isNumericWideningAssignable(source, target)) {
    return true;
  }

  // any is assignable to anything, anything is assignable to any
  if (source.kind === "anyType" || target.kind === "anyType") return true;

  // never is assignable to anything
  if (source.kind === "neverType") return true;

  if (target.kind === "unknownType" && target.explicit === true) {
    return source.kind !== "voidType";
  }

  if (isBroadObjectTargetType(target)) {
    return isAssignableToBroadObjectTarget(
      state,
      source,
      context.activeAliases
    );
  }

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
  if (sourceAlias && !context.activeAliases.has(sourceAlias.key)) {
    return isAssignableToInternal(
      state,
      sourceAlias.expanded,
      target,
      withActiveAlias(context, sourceAlias.key)
    );
  }

  const targetAlias = resolveAliasExpansion(state, target);
  if (targetAlias && !context.activeAliases.has(targetAlias.key)) {
    return isAssignableToInternal(
      state,
      source,
      targetAlias.expanded,
      withActiveAlias(context, targetAlias.key)
    );
  }

  // Primitives - same primitive type
  if (source.kind === "primitiveType" && target.kind === "primitiveType") {
    return source.name === target.name;
  }

  // Union source - all members must be assignable
  if (source.kind === "unionType") {
    return source.types.every((t) =>
      isAssignableToInternal(state, t, target, context)
    );
  }

  // Union target - source must be assignable to at least one member
  if (target.kind === "unionType") {
    return target.types.some((t) =>
      isAssignableToInternal(state, source, t, context)
    );
  }

  // Array types
  if (source.kind === "arrayType" && target.kind === "arrayType") {
    return isAssignableToInternal(
      state,
      source.elementType,
      target.elementType,
      context
    );
  }

  if (source.kind === "dictionaryType" && target.kind === "dictionaryType") {
    return (
      isAssignableToInternal(state, source.keyType, target.keyType, context) &&
      isAssignableToInternal(state, source.valueType, target.valueType, context)
    );
  }

  // Reference types - check nominal compatibility via TypeId
  if (source.kind === "referenceType" && target.kind === "referenceType") {
    const sourceIterable = getIterableShape(state, source);
    const targetIterable = getIterableShape(state, target);
    if (
      sourceIterable &&
      targetIterable &&
      sourceIterable.mode === targetIterable.mode
    ) {
      return isAssignableToInternal(
        state,
        sourceIterable.elementType,
        targetIterable.elementType,
        context
      );
    }

    const sourceNominal = normalizeToNominal(state, source);
    const targetNominal = normalizeToNominal(state, target);
    if (sourceNominal && targetNominal) {
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
      if (chain.some((t) => t.stableId === targetNominal.typeId.stableId)) {
        return true;
      }
    }

    return isStructurallyAssignable(state, source, target, context) ?? false;
  }

  const structuralAssignable = isStructurallyAssignable(
    state,
    source,
    target,
    context
  );
  if (structuralAssignable !== undefined) {
    return structuralAssignable;
  }

  // Conservative - return false if unsure
  return false;
};

export const isAssignableTo = (
  state: TypeSystemState,
  source: IrType,
  target: IrType
): boolean =>
  isAssignableToInternal(state, source, target, createAssignabilityContext());

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
