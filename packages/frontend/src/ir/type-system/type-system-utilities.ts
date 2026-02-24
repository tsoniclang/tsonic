/**
 * TypeSystem Utilities — Utility Type Expansion
 *
 * Implements all 13 TypeScript utility types with deterministic constraints.
 *
 * DAG position: depends on type-system-state + type-system-relations
 */

import type {
  IrType,
  IrInterfaceMember,
  IrPropertySignature,
  IrReferenceType,
} from "../types/index.js";
import type { UtilityTypeName } from "./types.js";
import { unknownType, neverType, voidType } from "./types.js";
import type { TypeSystemState, Site } from "./type-system-state.js";
import { emitDiagnostic, isNullishPrimitive } from "./type-system-state.js";
import { typesEqual, containsTypeParameter } from "./type-system-relations.js";

// ─────────────────────────────────────────────────────────────────────────
// expandUtility — Utility type expansion (Step 8)
//
// Implements all 13 utility types with deterministic constraints:
// - Partial/Required/Readonly: T must be object-like
// - Pick/Omit: K must be string literal union (finite keys)
// - ReturnType/Parameters: F must be function type
// - NonNullable: Works on any type
// - Exclude/Extract: Works on any types
// - Awaited: Recursive on Promise<T>, Task<T>, ValueTask<T>
// - Record: K must be finite literal union (string/number infinite → dictionary)
// ─────────────────────────────────────────────────────────────────────────

export const expandUtility = (
  state: TypeSystemState,
  name: UtilityTypeName,
  args: readonly IrType[],
  site?: Site
): IrType => {
  const firstArg = args[0];
  if (!firstArg) {
    emitDiagnostic(
      state,
      "TSN7414",
      `Utility type '${name}' requires a type argument`,
      site
    );
    return unknownType;
  }

  // For utility types that operate on T where T is a type parameter,
  // return a reference type that preserves the utility type structure.
  // This allows downstream substitution to expand it later.
  if (containsTypeParameter(firstArg)) {
    // NonNullable, Exclude, Extract, Awaited can still partially evaluate
    if (
      name !== "NonNullable" &&
      name !== "Exclude" &&
      name !== "Extract" &&
      name !== "Awaited"
    ) {
      return {
        kind: "referenceType",
        name,
        typeArguments: [...args],
      };
    }
  }

  switch (name) {
    case "Partial":
      return expandMappedUtility(state, firstArg, "optional", site);
    case "Required":
      return expandMappedUtility(state, firstArg, "required", site);
    case "Readonly":
      return expandMappedUtility(state, firstArg, "readonly", site);
    case "Pick": {
      const keysArg = args[1];
      if (!keysArg) {
        emitDiagnostic(
          state,
          "TSN7414",
          "Pick requires two type arguments",
          site
        );
        return unknownType;
      }
      return expandPickOmitUtility(state, firstArg, keysArg, true, site);
    }
    case "Omit": {
      const keysArg = args[1];
      if (!keysArg) {
        emitDiagnostic(
          state,
          "TSN7414",
          "Omit requires two type arguments",
          site
        );
        return unknownType;
      }
      return expandPickOmitUtility(state, firstArg, keysArg, false, site);
    }
    case "Record": {
      const valueArg = args[1];
      if (!valueArg) {
        emitDiagnostic(
          state,
          "TSN7414",
          "Record requires two type arguments",
          site
        );
        return unknownType;
      }
      return expandRecordUtility(state, firstArg, valueArg, site);
    }
    case "Exclude": {
      const uArg = args[1];
      if (!uArg) {
        emitDiagnostic(
          state,
          "TSN7414",
          "Exclude requires two type arguments",
          site
        );
        return unknownType;
      }
      return expandExcludeExtractUtility(firstArg, uArg, false);
    }
    case "Extract": {
      const uArg = args[1];
      if (!uArg) {
        emitDiagnostic(
          state,
          "TSN7414",
          "Extract requires two type arguments",
          site
        );
        return unknownType;
      }
      return expandExcludeExtractUtility(firstArg, uArg, true);
    }
    case "NonNullable":
      return expandNonNullableUtility(firstArg);
    case "ReturnType":
      return expandReturnTypeUtility(state, firstArg, site);
    case "Parameters":
      return expandParametersUtility(state, firstArg, site);
    case "Awaited":
      return expandAwaitedUtility(firstArg);
    case "InstanceType":
      // InstanceType<T> - not fully supported yet, return as-is
      return firstArg;
    default:
      emitDiagnostic(
        state,
        "TSN7414",
        `Unsupported utility type '${name}'`,
        site
      );
      return unknownType;
  }
};

// ─────────────────────────────────────────────────────────────────────────
// Utility Type Helper Functions
// ─────────────────────────────────────────────────────────────────────────

/**
 * Expand NonNullable<T>: Filter out null and undefined from union
 */
export const expandNonNullableUtility = (type: IrType): IrType => {
  // Direct null/undefined
  if (isNullishPrimitive(type)) {
    return neverType;
  }

  // Not a union - return as-is
  if (type.kind !== "unionType") {
    return type;
  }

  // Filter out null and undefined from union
  const filtered = type.types.filter((t) => !isNullishPrimitive(t));

  if (filtered.length === 0) {
    return neverType;
  }
  if (filtered.length === 1 && filtered[0]) {
    return filtered[0];
  }
  return { kind: "unionType", types: filtered };
};

/**
 * Expand Partial/Required/Readonly<T>: Mapped type transformation
 */
export const expandMappedUtility = (
  state: TypeSystemState,
  type: IrType,
  mode: "optional" | "required" | "readonly",
  site?: Site
): IrType => {
  // Must be object-like
  if (type.kind !== "objectType") {
    // For reference types, we need structural members
    if (type.kind === "referenceType") {
      // Try to get structural members from type
      const members = getStructuralMembersForType(state, type);
      if (members.length === 0) {
        emitDiagnostic(
          state,
          "TSN7414",
          `${mode === "optional" ? "Partial" : mode === "required" ? "Required" : "Readonly"} requires a concrete object type`,
          site
        );
        return unknownType;
      }
      // Transform the members
      return {
        kind: "objectType",
        members: transformMembers(members, mode),
      };
    }
    emitDiagnostic(
      state,
      "TSN7414",
      `${mode === "optional" ? "Partial" : mode === "required" ? "Required" : "Readonly"} requires an object type`,
      site
    );
    return unknownType;
  }

  return {
    kind: "objectType",
    members: transformMembers(type.members, mode),
  };
};

/**
 * Transform members for Partial/Required/Readonly
 */
export const transformMembers = (
  members: readonly IrInterfaceMember[],
  mode: "optional" | "required" | "readonly"
): IrInterfaceMember[] => {
  return members.map((m) => {
    if (m.kind === "propertySignature") {
      return {
        ...m,
        isOptional:
          mode === "optional"
            ? true
            : mode === "required"
              ? false
              : m.isOptional,
        isReadonly: mode === "readonly" ? true : m.isReadonly,
      };
    }
    return m;
  });
};

/**
 * Get structural members for a reference type
 */
export const getStructuralMembersForType = (
  state: TypeSystemState,
  type: IrReferenceType
): readonly IrInterfaceMember[] => {
  if (type.structuralMembers) {
    return type.structuralMembers;
  }
  // Try to look up in registry
  const fqName = state.typeRegistry.getFQName(type.name);
  const entry = fqName
    ? state.typeRegistry.resolveNominal(fqName)
    : state.typeRegistry.resolveBySimpleName(type.name);
  if (!entry) return [];

  // Convert registry members to IR members
  const members: IrInterfaceMember[] = [];
  entry.members.forEach((info, name) => {
    if (info.kind === "property" && info.type) {
      members.push({
        kind: "propertySignature",
        name,
        type: info.type,
        isOptional: info.isOptional,
        isReadonly: info.isReadonly,
      });
    }
  });
  return members;
};

/**
 * Expand Pick/Omit<T, K>: Filter members by keys
 */
export const expandPickOmitUtility = (
  state: TypeSystemState,
  type: IrType,
  keysType: IrType,
  isPick: boolean,
  site?: Site
): IrType => {
  // Extract literal keys from keysType
  const keys = extractLiteralKeys(keysType);
  if (keys === null) {
    emitDiagnostic(
      state,
      "TSN7414",
      `${isPick ? "Pick" : "Omit"} requires literal string keys`,
      site
    );
    return unknownType;
  }

  // Get members from type
  let members: readonly IrInterfaceMember[];
  if (type.kind === "objectType") {
    members = type.members;
  } else if (type.kind === "referenceType") {
    members = getStructuralMembersForType(state, type);
  } else {
    emitDiagnostic(
      state,
      "TSN7414",
      `${isPick ? "Pick" : "Omit"} requires an object type`,
      site
    );
    return unknownType;
  }

  // Filter members
  const filtered = members.filter((m) => {
    const include = isPick ? keys.has(m.name) : !keys.has(m.name);
    return include;
  });

  return { kind: "objectType", members: filtered };
};

/**
 * Extract literal keys from a type (string literals or union of string literals)
 */
export const extractLiteralKeys = (type: IrType): Set<string> | null => {
  if (type.kind === "literalType" && typeof type.value === "string") {
    return new Set([type.value]);
  }

  if (type.kind === "unionType") {
    const keys = new Set<string>();
    for (const t of type.types) {
      if (t.kind === "literalType" && typeof t.value === "string") {
        keys.add(t.value);
      } else if (t.kind === "literalType" && typeof t.value === "number") {
        keys.add(String(t.value));
      } else {
        return null; // Non-literal in union
      }
    }
    return keys;
  }

  return null;
};

/**
 * Expand ReturnType<F>: Extract return type from function type
 */
export const expandReturnTypeUtility = (
  state: TypeSystemState,
  type: IrType,
  site?: Site
): IrType => {
  if (type.kind === "functionType") {
    return type.returnType ?? voidType;
  }
  emitDiagnostic(
    state,
    "TSN7414",
    `ReturnType requires a function type argument`,
    site
  );
  return unknownType;
};

/**
 * Expand Parameters<F>: Extract parameters as tuple from function type
 */
export const expandParametersUtility = (
  state: TypeSystemState,
  type: IrType,
  site?: Site
): IrType => {
  if (type.kind === "functionType") {
    const elementTypes = type.parameters.map(
      (p) => p.type ?? { kind: "anyType" as const }
    );
    return { kind: "tupleType", elementTypes };
  }
  emitDiagnostic(
    state,
    "TSN7414",
    `Parameters requires a function type argument`,
    site
  );
  return unknownType;
};

/**
 * Expand Exclude<T, U> or Extract<T, U>
 */
export const expandExcludeExtractUtility = (
  tType: IrType,
  uType: IrType,
  isExtract: boolean
): IrType => {
  // If T is not a union, check if it matches U
  if (tType.kind !== "unionType") {
    const matches =
      typesEqual(tType, uType) ||
      (uType.kind === "unionType" &&
        uType.types.some((u) => typesEqual(tType, u)));
    if (isExtract) {
      return matches ? tType : neverType;
    } else {
      return matches ? neverType : tType;
    }
  }

  // T is a union - filter its constituents
  const uTypes = uType.kind === "unionType" ? uType.types : [uType];
  const filtered = tType.types.filter((t) => {
    const matches = uTypes.some((u) => typesEqual(t, u));
    return isExtract ? matches : !matches;
  });

  if (filtered.length === 0) return neverType;
  if (filtered.length === 1 && filtered[0]) return filtered[0];
  return { kind: "unionType", types: filtered };
};

/**
 * Expand Awaited<T>: Recursively unwrap Promise/Task/ValueTask.
 */
export const expandAwaitedUtility = (type: IrType): IrType => {
  // Direct Promise<T>
  if (type.kind === "referenceType") {
    if (
      (type.name === "Promise" || type.name === "PromiseLike") &&
      (type.typeArguments?.length ?? 0) === 1
    ) {
      const inner = type.typeArguments?.[0];
      return inner ? expandAwaitedUtility(inner) : type;
    }

    // CLR async types
    const clrName = type.typeId?.clrName;

    // Non-generic Task/ValueTask → void
    if (
      clrName === "System.Threading.Tasks.Task" ||
      clrName === "System.Threading.Tasks.ValueTask"
    ) {
      if (!type.typeArguments || type.typeArguments.length === 0) {
        return voidType;
      }
    }

    // Generic Task<T>/ValueTask<T>
    if (
      clrName?.startsWith("System.Threading.Tasks.Task`") ||
      clrName?.startsWith("System.Threading.Tasks.ValueTask`")
    ) {
      const inner = type.typeArguments?.[0];
      return inner ? expandAwaitedUtility(inner) : type;
    }
  }

  // Union: Awaited each member
  if (type.kind === "unionType") {
    const expanded = type.types.map(expandAwaitedUtility);
    return { kind: "unionType", types: expanded };
  }

  return type;
};

/**
 * Expand Record<K, V>: Create dictionary or object type.
 */
export const expandRecordUtility = (
  state: TypeSystemState,
  keyArg: IrType,
  valueArg: IrType,
  site?: Site
): IrType => {
  // string or number → dictionary type
  if (
    keyArg.kind === "primitiveType" &&
    (keyArg.name === "string" || keyArg.name === "number")
  ) {
    return {
      kind: "dictionaryType",
      keyType: keyArg,
      valueType: valueArg,
    };
  }

  // Finite literal union → object type
  const keys = extractLiteralKeys(keyArg);
  if (!keys) {
    emitDiagnostic(
      state,
      "TSN7414",
      "Record key type must be string, number, or string literal union",
      site
    );
    return unknownType;
  }

  const members: IrPropertySignature[] = Array.from(keys).map((key) => ({
    kind: "propertySignature" as const,
    name: key,
    type: valueArg,
    isOptional: false,
    isReadonly: false,
  }));

  return { kind: "objectType", members };
};
