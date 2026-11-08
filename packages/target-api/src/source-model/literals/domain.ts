import type { Node } from "@tsonic/tsts";
import type { SourceNumericLiteralEvidence } from "./value.js";

export type SourceLiteralUnit =
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "number"; readonly value: SourceNumericLiteralEvidence | { readonly kind: "integer"; readonly value: bigint } }
  | { readonly kind: "bigint"; readonly value: bigint }
  | { readonly kind: "absence" }
  | { readonly kind: "symbol"; readonly declaration: Node };

export type SourceLiteralDomain =
  | { readonly kind: "open"; readonly presence: "present" | "dynamic" }
  | { readonly kind: "unreachable" }
  | { readonly kind: "finite"; readonly values: readonly SourceLiteralUnit[] };

export const sourceOpenLiteralDomain: SourceLiteralDomain = Object.freeze({ kind: "open", presence: "dynamic" });
export const sourcePresentLiteralDomain: SourceLiteralDomain = Object.freeze({ kind: "open", presence: "present" });
export const sourceUnreachableLiteralDomain: SourceLiteralDomain = Object.freeze({ kind: "unreachable" });

export interface SourceNumericLiteralIdentity {
  readonly coefficient: bigint;
  readonly two: bigint;
  readonly five: bigint;
  readonly negative: boolean;
}

export function sourceNumericLiteralIdentity(value: Extract<SourceLiteralUnit, { readonly kind: "number" }>["value"]): SourceNumericLiteralIdentity | "nan" | "positive-infinity" | "negative-infinity" {
  let coefficient: bigint;
  let two: bigint;
  let five: bigint;
  let negative: boolean;
  if (value.kind === "authored") {
    if (value.token.coefficient < 0n) throw new Error("A Source numeric literal coefficient must be nonnegative.");
    coefficient = value.token.coefficient;
    two = value.token.exponent;
    five = value.token.exponent;
    negative = value.token.negative;
  } else if (value.kind === "integer") {
    coefficient = value.value < 0n ? -value.value : value.value;
    two = 0n;
    five = 0n;
    negative = value.value < 0n;
  } else {
    if (Number.isNaN(value.value)) return "nan";
    if (!Number.isFinite(value.value)) return value.value < 0 ? "negative-infinity" : "positive-infinity";
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setFloat64(0, value.value, false);
    const bits = view.getBigUint64(0, false);
    const exponent = (bits >> 52n) & 2047n;
    coefficient = bits & ((1n << 52n) - 1n);
    if (exponent !== 0n) coefficient |= 1n << 52n;
    two = exponent === 0n ? -1074n : exponent - 1075n;
    five = 0n;
    negative = (bits >> 63n) !== 0n;
  }
  if (coefficient === 0n) return { coefficient: 0n, two: 0n, five: 0n, negative: false };
  while ((coefficient & 1n) === 0n) { coefficient >>= 1n; two++; }
  while (coefficient % 5n === 0n) { coefficient /= 5n; five++; }
  return { coefficient, two, five, negative };
}

export function sourceLiteralUnitsEqual(left: SourceLiteralUnit, right: SourceLiteralUnit): boolean {
  if (left.kind !== right.kind) return false;
  switch (left.kind) {
    case "absence": return true;
    case "symbol": return right.kind === "symbol" && left.declaration === right.declaration;
    case "boolean": return right.kind === "boolean" && left.value === right.value;
    case "string": return right.kind === "string" && left.value === right.value;
    case "bigint": return right.kind === "bigint" && left.value === right.value;
    case "number": {
      if (right.kind !== "number") return false;
      const first = sourceNumericLiteralIdentity(left.value), second = sourceNumericLiteralIdentity(right.value);
      if (typeof first === "string" || typeof second === "string") return first === second;
      return first.coefficient === second.coefficient && first.two === second.two && first.five === second.five && first.negative === second.negative;
    }
  }
}

export function sourceFiniteLiteralDomain(values: readonly SourceLiteralUnit[]): SourceLiteralDomain {
  if (values.length === 0) return sourceUnreachableLiteralDomain;
  const selected: SourceLiteralUnit[] = [];
  for (const value of values) {
    if (value.kind === "number") sourceNumericLiteralIdentity(value.value);
    if (selected.some(previous => sourceLiteralUnitsEqual(previous, value))) continue;
    if (value.kind !== "number") selected.push(Object.freeze({ ...value }));
    else {
      const numeric = value.value.kind === "authored"
        ? Object.freeze({ kind: "authored" as const, token: Object.freeze({ ...value.value.token }) })
        : Object.freeze({ ...value.value });
      selected.push(Object.freeze({ kind: "number", value: numeric }));
    }
  }
  return Object.freeze({ kind: "finite", values: Object.freeze(selected) });
}

export function sourceLiteralDomainUnion(values: readonly SourceLiteralDomain[]): SourceLiteralDomain {
  const units: SourceLiteralUnit[] = [];
  let openPresent = false;
  for (const value of values) {
    if (value.kind === "open") {
      if (value.presence === "dynamic") return sourceOpenLiteralDomain;
      openPresent = true;
    }
    if (value.kind === "finite") units.push(...value.values);
  }
  if (openPresent) return units.some(value => value.kind === "absence") ? sourceOpenLiteralDomain : sourcePresentLiteralDomain;
  return sourceFiniteLiteralDomain(units);
}

export function sourceLiteralDomainIncludes(domain: SourceLiteralDomain, value: SourceLiteralUnit): boolean {
  return domain.kind === "open" ? domain.presence === "dynamic" || value.kind !== "absence"
    : domain.kind === "finite" && domain.values.some(candidate => sourceLiteralUnitsEqual(candidate, value));
}

export function sourceBooleanLiteralDisposition(domain: SourceLiteralDomain): "true" | "false" | "dynamic" {
  if (domain.kind !== "finite" || domain.values.length === 0) return "dynamic";
  if (domain.values.every(value => value.kind === "boolean" && value.value)) return "true";
  return domain.values.every(value => value.kind === "boolean" && !value.value) ? "false" : "dynamic";
}

export function sourcePresenceLiteralDisposition(domain: SourceLiteralDomain): "present" | "absent" | "dynamic" {
  if (domain.kind === "open") return domain.presence;
  if (domain.kind !== "finite" || domain.values.length === 0) return "dynamic";
  if (domain.values.every(value => value.kind === "absence")) return "absent";
  return domain.values.every(value => value.kind !== "absence") ? "present" : "dynamic";
}
