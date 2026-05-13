/**
 * Nullish stripping, value-type classification, array-like element extraction,
 * and type-alias resolution. Foundational leaf utilities consumed by all other
 * type-resolution sub-modules.
 *
 * Type-argument substitution lives in:
 *   - type-substitution.ts
 */

import type { IrType } from "@tsonic/frontend";
import { normalizedUnionType } from "@tsonic/frontend";
import { contextSurfaceIncludesJs, type EmitterContext } from "../../types.js";
import { getIdentifierTypeName } from "../format/backend-ast/utils.js";
import { resolveLocalTypeInfo } from "./property-lookup-resolution.js";
import { rebuildUnionTypePreservingCarrierFamily } from "./runtime-union-family-preservation.js";
import { substituteTypeArgs } from "./type-substitution.js";
import {
  canUseLocalTypeLookupCandidate,
  getLocalTypeLookupCandidates,
} from "./local-type-lookup.js";

// ---------------------------------------------------------------------------
// stripNullish
// ---------------------------------------------------------------------------

export const stripNullish = (type: IrType): IrType => {
  if (type.kind !== "unionType") return type;

  const nonNullish = type.types.filter(
    (t) =>
      !(
        t.kind === "primitiveType" &&
        (t.name === "null" || t.name === "undefined")
      )
  );

  // Single non-nullish type: return it (e.g., T | null -> T)
  if (nonNullish.length === 1 && nonNullish[0]) {
    return nonNullish[0];
  }

  if (nonNullish.length === type.types.length) {
    return type;
  }

  if (nonNullish.length > 1) {
    return rebuildUnionTypePreservingCarrierFamily(type, nonNullish);
  }

  return type;
};

// ---------------------------------------------------------------------------
// isRuntimeNullishMember / isRuntimeNullishType
// ---------------------------------------------------------------------------

export const isRuntimeNullishMember = (type: IrType): boolean =>
  type.kind === "primitiveType" &&
  (type.name === "null" || type.name === "undefined");

/**
 * Runtime-absence members in TypeScript unions.
 *
 * `void` is a type-level way of saying "the runtime value is undefined".
 * For C# emission we must treat `void` exactly like `undefined` / `null`
 * when deciding whether a union can be represented as a nullable type.
 */
export const isRuntimeNullishType = (type: IrType): boolean =>
  type.kind === "voidType" ||
  (type.kind === "primitiveType" &&
    (type.name === "null" || type.name === "undefined"));

// ---------------------------------------------------------------------------
// splitRuntimeNullishUnionMembers
// ---------------------------------------------------------------------------

/**
 * Split a union into runtime-nullish members and non-nullish members.
 *
 * Returns `undefined` for non-union types.
 */
export const splitRuntimeNullishUnionMembers = (
  type: IrType
):
  | {
      readonly hasRuntimeNullish: boolean;
      readonly nonNullishMembers: readonly IrType[];
    }
  | undefined => {
  if (type.kind !== "unionType") {
    return undefined;
  }

  const nonNullishMembers = type.types.filter((member) => {
    return !isRuntimeNullishType(member);
  });

  if (type.runtimeUnionLayout === "carrierSlotOrder") {
    return {
      hasRuntimeNullish: nonNullishMembers.length !== type.types.length,
      nonNullishMembers,
    };
  }

  const canonicalUnion =
    nonNullishMembers.length <= 1
      ? undefined
      : normalizedUnionType(nonNullishMembers);
  const canonicalMembers =
    nonNullishMembers.length <= 1
      ? nonNullishMembers
      : canonicalUnion?.kind === "unionType"
        ? canonicalUnion.types
        : canonicalUnion
          ? [canonicalUnion]
          : nonNullishMembers;

  return {
    hasRuntimeNullish: nonNullishMembers.length !== type.types.length,
    nonNullishMembers: canonicalMembers,
  };
};

// ---------------------------------------------------------------------------
// isDefinitelyValueType
// ---------------------------------------------------------------------------

const CLR_VALUE_TYPES = new Set([
  "global::System.DateTime",
  "global::System.DateOnly",
  "global::System.TimeOnly",
  "global::System.TimeSpan",
  "global::System.Guid",
  "global::System.Decimal",
  "System.DateTime",
  "System.DateOnly",
  "System.TimeOnly",
  "System.TimeSpan",
  "System.Guid",
  "System.Decimal",
]);

const TS_VALUE_TYPE_REFERENCE_NAMES = new Set([
  "bool",
  "boolean",
  "byte",
  "sbyte",
  "short",
  "ushort",
  "int",
  "uint",
  "long",
  "ulong",
  "nint",
  "nuint",
  "char",
  "float",
  "double",
  "decimal",
  "Half",
  "System.Half",
  "Int128",
  "System.Int128",
  "UInt128",
  "System.UInt128",
]);

/**
 * Check if a type is definitely a C# value type.
 *
 * Value types require `default` instead of `null` in object initializers
 * because `null` cannot be assigned to non-nullable value types.
 *
 * @param type - The type to check (should be non-nullish, use stripNullish first)
 * @returns true if the type is a known value type
 */
export const isDefinitelyValueType = (type: IrType): boolean => {
  // Strip nullish first if caller forgot
  const base = stripNullish(type);

  // Primitive value types (number -> double, int -> int, boolean -> bool, char -> char)
  if (base.kind === "primitiveType") {
    return ["number", "int", "boolean", "char"].includes(base.name);
  }

  if (base.kind === "tupleType") {
    return true;
  }

  // Known CLR struct types
  if (base.kind === "referenceType") {
    if (TS_VALUE_TYPE_REFERENCE_NAMES.has(base.name)) {
      return true;
    }
    const clr = base.resolvedClrType;
    if (clr && CLR_VALUE_TYPES.has(clr)) {
      return true;
    }
  }

  return false;
};

// ---------------------------------------------------------------------------
// getArrayLikeElementType / resolveArrayLikeReceiverType
// ---------------------------------------------------------------------------

/**
 * Resolve the element type of an array-like IR type after alias/nullish expansion.
 *
 * This is used by emission paths that need the element contract of rest parameters
 * or contextual array expressions even when the surface type is spelled through
 * local aliases or ReadonlyArray-style wrappers.
 */
export const getArrayLikeElementType = (
  type: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!type) return undefined;

  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "arrayType") {
    return resolved.elementType;
  }
  if (
    contextSurfaceIncludesJs(context) &&
    resolved.kind === "referenceType" &&
    (resolved.name === "Array" ||
      resolved.name === "ReadonlyArray" ||
      resolved.name === "ArrayLike") &&
    resolved.typeArguments?.length === 1
  ) {
    const localTypeInfo = resolveLocalTypeInfo(resolved, context);
    if (localTypeInfo?.info.kind === "class") {
      return undefined;
    }
    return resolved.typeArguments[0];
  }

  return undefined;
};

export const resolveArrayLikeReceiverType = (
  type: IrType | undefined,
  context: EmitterContext
): Extract<IrType, { kind: "arrayType" }> | undefined => {
  if (!type) return undefined;

  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "arrayType") {
    return resolved;
  }

  const elementType = getArrayLikeElementType(type, context);
  if (!elementType) {
    return undefined;
  }

  return {
    kind: "arrayType",
    elementType,
    origin: "explicit",
  };
};

// ---------------------------------------------------------------------------
// resolveTypeAlias
// ---------------------------------------------------------------------------

/**
 * Resolve a type alias to its underlying type.
 *
 * If the type is a reference type that points to a type alias,
 * returns the underlying type with type arguments substituted.
 *
 * @param type - The type to resolve
 * @param context - Emitter context with localTypes map
 * @returns The resolved underlying type, or the original type if not an alias
 */
export const resolveTypeAlias = (
  type: IrType,
  context: EmitterContext,
  options: {
    readonly preserveObjectTypeAliases?: boolean;
  } = {}
): IrType => {
  if (type.kind !== "referenceType") {
    return type;
  }

  const stripGlobalPrefix = (name: string): string =>
    name.startsWith("global::") ? name.slice("global::".length) : name;

  const lookupCandidates = getLocalTypeLookupCandidates(type.name);

  const localTypeInfo = (() => {
    for (const candidate of lookupCandidates) {
      const hit = context.localTypes?.get(candidate.name);
      if (hit && canUseLocalTypeLookupCandidate(hit, candidate)) {
        return hit;
      }
    }

    return undefined;
  })();
  if (localTypeInfo?.kind === "typeAlias") {
    if (
      options.preserveObjectTypeAliases &&
      localTypeInfo.type.kind === "objectType"
    ) {
      return type;
    }

    // Substitute type arguments if present
    if (type.typeArguments && type.typeArguments.length > 0) {
      const substituted = substituteTypeArgs(
        localTypeInfo.type,
        localTypeInfo.typeParameters,
        type.typeArguments
      );
      return substituted;
    }

    return localTypeInfo.type;
  }

  const importedAliasBinding =
    context.importBindings?.get(type.name) ??
    lookupCandidates
      .map((candidate) => context.importBindings?.get(candidate.name))
      .find((binding) => binding !== undefined);
  if (
    importedAliasBinding?.kind === "type" &&
    importedAliasBinding.aliasType !== undefined
  ) {
    if (
      options.preserveObjectTypeAliases &&
      importedAliasBinding.aliasType.kind === "objectType"
    ) {
      return type;
    }

    if (type.typeArguments && type.typeArguments.length > 0) {
      const substituted = substituteTypeArgs(
        importedAliasBinding.aliasType,
        importedAliasBinding.aliasTypeParameters ?? [],
        type.typeArguments
      );
      return substituted;
    }

    return importedAliasBinding.aliasType;
  }

  const moduleMap = context.options.moduleMap;
  if (moduleMap) {
    const importedBindingTypeName =
      importedAliasBinding?.kind === "type"
        ? getIdentifierTypeName(importedAliasBinding.typeAst)
        : undefined;
    const crossModuleAliasMatches: {
      readonly namespace: string;
      readonly type: IrType;
      readonly typeParameters: readonly string[];
    }[] = [];

    for (const candidate of lookupCandidates) {
      for (const moduleInfo of moduleMap.values()) {
        const aliasInfo = moduleInfo.localTypes?.get(candidate.name);
        if (
          !aliasInfo ||
          aliasInfo.kind !== "typeAlias" ||
          !canUseLocalTypeLookupCandidate(aliasInfo, candidate)
        ) {
          continue;
        }

        crossModuleAliasMatches.push({
          namespace: moduleInfo.namespace,
          type: aliasInfo.type,
          typeParameters: aliasInfo.typeParameters,
        });
      }
    }

    const resolveCrossModuleAlias = (
      match:
        | {
            readonly namespace: string;
            readonly type: IrType;
            readonly typeParameters: readonly string[];
          }
        | undefined
    ): IrType | undefined => {
      if (!match) {
        return undefined;
      }

      if (
        options.preserveObjectTypeAliases &&
        match.type.kind === "objectType"
      ) {
        return type;
      }

      if (type.typeArguments && type.typeArguments.length > 0) {
        const substituted = substituteTypeArgs(
          match.type,
          match.typeParameters,
          type.typeArguments
        );
        return substituted;
      }

      return match.type;
    };

    const fqnCandidate =
      (importedBindingTypeName
        ? stripGlobalPrefix(importedBindingTypeName)
        : undefined) ??
      type.resolvedClrType ??
      type.typeId?.clrName ??
      (type.name.includes(".") ? stripGlobalPrefix(type.name) : undefined);
    if (fqnCandidate && fqnCandidate.includes(".")) {
      const namespace = fqnCandidate.slice(0, fqnCandidate.lastIndexOf("."));
      const scopedMatches = crossModuleAliasMatches.filter(
        (match) => match.namespace === namespace
      );
      if (scopedMatches.length === 1) {
        const resolved = resolveCrossModuleAlias(scopedMatches[0]);
        if (resolved) {
          return resolved;
        }
      }
    }
  }

  const aliasIndex = context.options.typeAliasIndex;
  if (!aliasIndex) {
    return type;
  }

  const qualifiedAliasCandidates = [
    type.resolvedClrType,
    type.typeId?.clrName,
    stripGlobalPrefix(type.name),
  ]
    .filter((candidate): candidate is string => !!candidate)
    .map(stripGlobalPrefix);
  const directAliasEntry = qualifiedAliasCandidates
    .map((candidate) => aliasIndex.byFqn.get(candidate))
    .find((entry) => entry !== undefined);
  const aliasEntry =
    directAliasEntry ??
    (() => {
      const hasQualifiedCandidate = qualifiedAliasCandidates.some((candidate) =>
        candidate.includes(".")
      );
      if (hasQualifiedCandidate) {
        return undefined;
      }

      const simpleMatches = lookupCandidates.flatMap((candidate) =>
        [...aliasIndex.byFqn.values()].filter(
          (entry) =>
            entry.name === candidate.name ||
            entry.fqn.split(".").at(-1) === candidate.name
        )
      );
      const uniqueMatches = [
        ...new Map(simpleMatches.map((entry) => [entry.fqn, entry])).values(),
      ];
      return uniqueMatches.length === 1 ? uniqueMatches[0] : undefined;
    })();

  if (!aliasEntry) {
    return type;
  }

  if (
    options.preserveObjectTypeAliases &&
    aliasEntry.type.kind === "objectType"
  ) {
    return type;
  }

  if (type.typeArguments && type.typeArguments.length > 0) {
    const substituted = substituteTypeArgs(
      aliasEntry.type,
      aliasEntry.typeParameters,
      type.typeArguments
    );
    return substituted;
  }

  return aliasEntry.type;
};
