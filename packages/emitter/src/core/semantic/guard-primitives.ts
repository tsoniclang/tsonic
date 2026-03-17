/**
 * Shared guard-detection primitives used by both ternary guard analysis
 * (core/semantic/ternary-guards.ts) and if-statement guard analysis
 * (statements/control/conditionals/guard-analysis.ts).
 *
 * These are pure helpers with no emission imports — they only depend on
 * IR types, EmitterContext, and peer core/semantic modules.
 */

import { IrType } from "@tsonic/frontend";
import { EmitterContext, LocalTypeInfo } from "../../types.js";
import { resolveTypeAlias } from "./type-resolution.js";

/**
 * Resolve a reference type's LocalTypeInfo map (possibly from a different module).
 *
 * This is required for airplane-grade narrowing features that depend on member *types*
 * (not just member names), e.g. discriminant literal equality checks.
 */
export const resolveLocalTypesForReference = (
  type: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): ReadonlyMap<string, LocalTypeInfo> | undefined => {
  const lookupName = type.name.includes(".")
    ? (type.name.split(".").pop() ?? type.name)
    : type.name;

  if (context.localTypes?.has(lookupName)) {
    return context.localTypes;
  }

  const moduleMap = context.options.moduleMap;
  if (!moduleMap) return undefined;

  const matches: {
    readonly namespace: string;
    readonly localTypes: ReadonlyMap<string, LocalTypeInfo>;
  }[] = [];
  for (const m of moduleMap.values()) {
    if (!m.localTypes) continue;
    if (m.localTypes.has(lookupName)) {
      matches.push({
        namespace: m.namespace,
        localTypes: m.localTypes,
      });
    }
  }

  if (matches.length === 0) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  if (matches.length === 1) return matches[0]!.localTypes;

  // Disambiguate by CLR FQN when available.
  const fqn =
    type.resolvedClrType ?? (type.name.includes(".") ? type.name : undefined);
  if (fqn && fqn.includes(".")) {
    const lastDot = fqn.lastIndexOf(".");
    const ns = fqn.slice(0, lastDot);
    const filtered = matches.filter((m) => m.namespace === ns);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (filtered.length === 1) return filtered[0]!.localTypes;
  }

  // Ambiguous: refuse to guess.
  return undefined;
};

/**
 * Extract the set of allowed discriminant literal values from a type.
 *
 * Airplane-grade rule:
 * - The discriminant property must be typed as a literal or a union of literals.
 * - If it includes any non-literal members (including null/undefined), we refuse to treat
 *   it as a discriminant for equality-guard narrowing.
 */
export const tryGetLiteralSet = (
  type: IrType,
  context: EmitterContext
): ReadonlySet<string | number | boolean> | undefined => {
  const resolved = resolveTypeAlias(type, context);

  if (resolved.kind === "literalType") {
    return new Set([resolved.value]);
  }

  if (resolved.kind === "unionType") {
    const out = new Set<string | number | boolean>();
    for (const t of resolved.types) {
      const r = resolveTypeAlias(t, context);
      if (r.kind !== "literalType") return undefined;
      out.add(r.value);
    }
    return out;
  }

  return undefined;
};
