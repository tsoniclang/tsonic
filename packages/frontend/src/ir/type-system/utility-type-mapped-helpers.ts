/**
 * Utility Type Mapped Helpers — Partial/Required/Readonly/Pick/Omit expansion
 *
 * Implements mapped utility types that transform object type members:
 * - Partial/Required/Readonly: T must be object-like
 * - Pick/Omit: K must be string literal union (finite keys)
 *
 * DAG position: depends on type-system-state + type-system-relations
 */

import type {
  IrType,
  IrInterfaceMember,
  IrReferenceType,
} from "../types/index.js";
import type { UtilityTypeName } from "./types.js";
import { unknownType } from "./types.js";
import type { TypeSystemState, Site } from "./type-system-state.js";
import { emitDiagnostic } from "./type-system-state.js";
import { containsTypeParameter } from "./type-system-relations.js";

import {
  expandExcludeExtractUtility,
  expandNonNullableUtility,
  expandReturnTypeUtility,
  expandParametersUtility,
  expandAwaitedUtility,
  expandRecordUtility,
} from "./utility-type-filter-helpers.js";

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
      return expandAwaitedUtility(state, firstArg);
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
// Mapped Utility Type Helper Functions
// ─────────────────────────────────────────────────────────────────────────

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
