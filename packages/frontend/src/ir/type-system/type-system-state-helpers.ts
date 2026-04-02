import type { IrType, IrPrimitiveType } from "../types/index.js";
import type { DiagnosticCode } from "../../types/diagnostic.js";
import { stableIrTypeKey } from "../types/type-ops.js";
import type { TypeId } from "./internal/universe/types.js";
import type { TypeSystemState } from "./type-system-state-model.js";
import type { Site } from "./type-system-state-types.js";
import { BUILTIN_NOMINALS } from "./type-system-state-registry-types.js";

// ═══════════════════════════════════════════════════════════════════════════
// DIAGNOSTIC HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export const emitDiagnostic = (
  state: TypeSystemState,
  code: DiagnosticCode,
  message: string,
  site?: Site
): void => {
  const location =
    site?.file !== undefined &&
    site?.line !== undefined &&
    site?.column !== undefined
      ? {
          file: site.file,
          line: site.line,
          column: site.column,
          length: 1, // Default length
        }
      : undefined;

  state.diagnostics.push({
    code,
    severity: "error",
    message,
    location,
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// CACHE KEY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a cache key for member type lookup.
 */
export const makeMemberCacheKey = (
  fqName: string,
  memberName: string,
  typeArgs?: readonly IrType[]
): string => {
  if (typeArgs && typeArgs.length > 0) {
    return `${fqName}:${memberName}:${typeArgs.map(stableIrTypeKey).join(",")}`;
  }
  return `${fqName}:${memberName}`;
};

/**
 * Create a cache key for nominal lookup.
 */
export const makeNominalLookupKey = (
  fqName: string,
  typeArgs: readonly IrType[],
  memberName: string
): string => {
  return `${fqName}:${typeArgs.map(stableIrTypeKey).join(",")}:${memberName}`;
};

// Helper to check if type is null/undefined primitive
export const isNullishPrimitive = (
  t: IrType
): t is IrPrimitiveType & { name: "null" | "undefined" } => {
  return (
    t.kind === "primitiveType" && (t.name === "null" || t.name === "undefined")
  );
};

export const addUndefinedToType = (type: IrType): IrType => {
  const undefinedType: IrType = { kind: "primitiveType", name: "undefined" };
  if (type.kind === "unionType") {
    const hasUndefined = type.types.some(
      (x) => x.kind === "primitiveType" && x.name === "undefined"
    );
    return hasUndefined
      ? type
      : { ...type, types: [...type.types, undefinedType] };
  }
  return { kind: "unionType", types: [type, undefinedType] };
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPE ID RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolve a surface name to a canonical TypeId.
 *
 * Order:
 * 1) AliasTable (primitives/globals/System.* canonicalization)
 * 2) UnifiedTypeCatalog source-authored tsName
 * 3) UnifiedTypeCatalog assembly tsName
 * 4) UnifiedTypeCatalog by clrName
 *
 * Canonical aliases must win over source-authored global wrapper declarations.
 * Example:
 * - source `interface String extends String$instance, __String$views {}`
 * - canonical alias `String -> System.String`
 *
 * Member lookup on `string` / `String` must resolve against the canonical CLR
 * entry so instance members like `IndexOf` and `Substring` remain available.
 *
 * IMPORTANT (airplane-grade):
 * Resolution must be arity-aware when type arguments are present. Facade
 * types often omit the `_N` generic arity suffix (e.g. `IList<T>` is a
 * facade over `IList_1<T>`). When `arity` is provided and the direct
 * resolution doesn't match, we deterministically try `<name>_<arity>`.
 */
export const resolveTypeIdByName = (
  state: TypeSystemState,
  name: string,
  arity?: number
): TypeId | undefined => {
  const tsNameCandidate = state.unifiedCatalog.resolveTsName(name);
  const sourceTsNameCandidate =
    tsNameCandidate &&
    state.unifiedCatalog.getByTypeId(tsNameCandidate)?.origin === "source"
      ? tsNameCandidate
      : undefined;
  const assemblyTsNameCandidate =
    tsNameCandidate &&
    state.unifiedCatalog.getByTypeId(tsNameCandidate)?.origin !== "source"
      ? tsNameCandidate
      : undefined;
  const directCandidates: TypeId[] = [];
  const pushCandidate = (candidate: TypeId | undefined): void => {
    if (!candidate) return;
    if (
      directCandidates.some(
        (existing) => existing.stableId === candidate.stableId
      )
    ) {
      return;
    }
    directCandidates.push(candidate);
  };

  pushCandidate(state.aliasTable.get(name));
  pushCandidate(sourceTsNameCandidate);
  pushCandidate(assemblyTsNameCandidate);
  pushCandidate(state.unifiedCatalog.resolveClrName(name));

  if (arity === undefined) {
    return directCandidates[0];
  }

  const matchesArity = (candidate: TypeId): boolean =>
    state.unifiedCatalog.getTypeParameters(candidate).length === arity;

  const directMatch = directCandidates.find(matchesArity);
  if (directMatch) return directMatch;

  // Facade name without arity suffix → try tsbindgen's structural encoding.
  if (arity > 0) {
    const suffixed = `${name}_${arity}`;
    const suffixedCandidates: TypeId[] = [];
    const pushSuffixedCandidate = (candidate: TypeId | undefined): void => {
      if (!candidate) return;
      if (
        suffixedCandidates.some(
          (existing) => existing.stableId === candidate.stableId
        )
      ) {
        return;
      }
      suffixedCandidates.push(candidate);
    };

    pushSuffixedCandidate(state.aliasTable.get(suffixed));
    pushSuffixedCandidate(state.unifiedCatalog.resolveTsName(suffixed));
    pushSuffixedCandidate(state.unifiedCatalog.resolveClrName(suffixed));

    const suffixedMatch = suffixedCandidates.find(matchesArity);
    if (suffixedMatch) return suffixedMatch;
  }

  return undefined;
};

export const resolveSourceReferenceFQName = (
  state: TypeSystemState,
  type: Extract<IrType, { kind: "referenceType" }>
): string | undefined => {
  if (type.resolvedClrType || type.name.includes(".")) {
    return undefined;
  }

  const direct = state.typeRegistry.getFQName(type.name);
  if (direct) {
    return direct;
  }

  const allFqNames = state.typeRegistry.getFQNames(type.name);
  const dottedCandidates = allFqNames.filter((fqName) => fqName.includes("."));
  if (dottedCandidates.length === 1) {
    const [onlyDotted] = dottedCandidates;
    if (onlyDotted) {
      return onlyDotted;
    }
  }

  const structuralMembers = type.structuralMembers;
  if (!structuralMembers || structuralMembers.length === 0) {
    return undefined;
  }

  const candidates = allFqNames.filter((fqName) => {
    const entry = state.typeRegistry.resolveNominal(fqName);
    if (!entry) {
      return false;
    }

    return structuralMembers.every((member) => {
      const entryMember = entry.members.get(member.name);
      if (!entryMember) {
        return false;
      }

      if (member.kind === "propertySignature") {
        return entryMember.kind === "property";
      }

      if (member.kind === "methodSignature") {
        return (
          entryMember.kind === "method" &&
          (entryMember.methodSignatures?.some(
            (signature) => signature.parameters.length === member.parameters.length
          ) ?? false)
        );
      }

      return false;
    });
  });

  return candidates.length === 1 ? candidates[0] : undefined;
};

// ═══════════════════════════════════════════════════════════════════════════
// NORMALIZATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize a receiver type to nominal form for member lookup.
 *
 * Phase 6: Returns TypeId + typeArgs for TypeId-based NominalEnv.
 *
 * ALICE'S RULE R3: Primitive-to-nominal bridging is part of TypeSystem.
 */
export const normalizeToNominal = (
  state: TypeSystemState,
  type: IrType
): { typeId: TypeId; typeArgs: readonly IrType[] } | undefined => {
  if (type.kind === "referenceType") {
    const arity = type.typeArguments?.length;
    const sourceFqName = resolveSourceReferenceFQName(state, type);
    const typeId =
      (type.resolvedClrType
        ? resolveTypeIdByName(state, type.resolvedClrType, arity)
        : undefined) ??
      (sourceFqName
        ? resolveTypeIdByName(state, sourceFqName, arity)
        : undefined) ??
      type.typeId ??
      (!sourceFqName ? resolveTypeIdByName(state, type.name, arity) : undefined);
    if (!typeId) return undefined;
    return { typeId, typeArgs: type.typeArguments ?? [] };
  }

  if (type.kind === "primitiveType") {
    const builtinNominalName = BUILTIN_NOMINALS[type.name];
    const typeId =
      (builtinNominalName
        ? resolveTypeIdByName(state, builtinNominalName, 0)
        : undefined) ?? resolveTypeIdByName(state, type.name, 0);
    if (!typeId) return undefined;
    return { typeId, typeArgs: [] };
  }

  if (type.kind === "arrayType") {
    const arrayTypeId = resolveTypeIdByName(state, "Array", 1);
    if (!arrayTypeId) return undefined;
    return { typeId: arrayTypeId, typeArgs: [type.elementType] };
  }

  return undefined;
};

// tsbindgen-generated "sticky extension scope" helpers are TS-only wrappers that
// must erase for deterministic IR typing and call inference.
//
// Example (generated bindings for Tsonic source):
//   import type { ExtensionMethods as __TsonicExt_Ef } from "@tsonic/efcore/Microsoft.EntityFrameworkCore.js";
//   readonly Tenants: __TsonicExt_Ef<...>;
//
// These wrapper types have no CLR identity. For the compiler, the only meaningful
// runtime/CLR shape is the inner type argument.
export const stripTsonicExtensionWrappers = (type: IrType): IrType => {
  if (type.kind === "referenceType") {
    if (
      type.name.startsWith("__TsonicExt_") &&
      (type.typeArguments?.length ?? 0) === 1
    ) {
      const inner = type.typeArguments?.[0];
      return inner ? stripTsonicExtensionWrappers(inner) : type;
    }
  }
  return type;
};

export const stripNullishForInference = (type: IrType): IrType | undefined => {
  if (isNullishPrimitive(type)) return undefined;
  if (type.kind !== "unionType") return type;
  const filtered = type.types.filter((t) => !isNullishPrimitive(t));
  if (filtered.length === 0) return undefined;
  if (filtered.length === 1 && filtered[0]) return filtered[0];
  return { kind: "unionType", types: filtered };
};
