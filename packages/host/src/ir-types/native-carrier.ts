import type { TyId } from "../ids/contract.js";
import type { LiteralCompatibilityReader, LiteralTypeValuesEqual, NativeCarrierOf, OptionalValueDomainOf } from "./contract.js";
import type { CategoryEvidence, LiteralTypeValue, TypeTable, TypeTerm } from "./data.js";

type BaseResult =
  | { readonly kind: "type"; readonly type: TyId; readonly term: Exclude<TypeTerm, { readonly kind: "literal" }> }
  | { readonly kind: "malformed-type"; readonly type: TyId; readonly reason: "domain" | "row" }
  | { readonly kind: "resource-stop" };
type LiteralCheck = { readonly value: LiteralTypeValue; readonly admit: LiteralCompatibilityReader["admit"] };

export const literalTypeValuesEqual: LiteralTypeValuesEqual = (left, right) => {
  switch (left.kind) {
    case "absence": return right.kind === "absence";
    case "boolean": return right.kind === "boolean" && left.value === right.value;
    case "string": return right.kind === "string" && left.value === right.value;
    case "unique-symbol": return right.kind === "unique-symbol" && left.declaration === right.declaration;
    case "bigint": return right.kind === "bigint" && left.value === right.value;
    case "number": return right.kind === "number" && left.value.numerator === right.value.numerator
      && left.value.denominator === right.value.denominator && left.value.negativeZero === right.value.negativeZero;
  }
};

export function readLiteralBase(table: TypeTable, type: TyId, typeOf: LiteralCompatibilityReader["typeOf"], check: null): BaseResult;
export function readLiteralBase(table: TypeTable, type: TyId, typeOf: LiteralCompatibilityReader["typeOf"], check: LiteralCheck): BaseResult | { readonly kind: "incompatible" };
export function readLiteralBase(table: TypeTable, type: TyId, typeOf: LiteralCompatibilityReader["typeOf"],
  check: LiteralCheck | null): BaseResult | { readonly kind: "incompatible" } {
  let selected = type;
  let remaining = table.terms.length;
  for (;;) {
    if (!Number.isSafeInteger(selected) || selected < 0 || Object.is(selected, -0) || selected >= table.terms.length)
      return { kind: "malformed-type", type: selected, reason: "domain" };
    if (remaining === 0) throw new TypeError("A native carrier literal-base relation must be acyclic");
    const term = typeOf(selected);
    if (term === null) return { kind: "resource-stop" };
    if (term === undefined) return { kind: "malformed-type", type: selected, reason: "row" };
    remaining -= 1;
    if (term.kind !== "literal") return { kind: "type", type: selected, term };
    if (check !== null) {
      const actual = check.value;
      const expected = term.value;
      const work = actual.kind === "string" ? actual.value.length : actual.kind === "unique-symbol" ? actual.declaration.length : 1;
      const other = expected.kind === "string" ? expected.value.length : expected.kind === "unique-symbol" ? expected.declaration.length : 1;
      if (!check.admit(1 + work + other, 0)) return { kind: "resource-stop" };
      if (!literalTypeValuesEqual(actual, expected)) return { kind: "incompatible" };
    }
    selected = term.base;
  }
}

export const nativeCarrierOf: NativeCarrierOf = (table, type, typeOf) => {
  const result = readLiteralBase(table, type, typeOf, null);
  switch (result.kind) {
    case "type": return result.term.kind === "primitive"
      ? { kind: "primitive", type: result.type, primitive: result.term.primitive }
      : { kind: "needs-selected-association", type: result.type };
    case "resource-stop": return result;
    case "malformed-type": throw new TypeError(result.reason === "domain"
      ? "A native carrier requires its actual ready type domain" : "A native carrier requires a complete ready type row");
  }
};

const booleanOrAbsence: CategoryEvidence = { kind: "choice",
  alternatives: [{ kind: "known", category: "boolean" }, { kind: "known", category: "absence" }] };
const numberOrAbsence: CategoryEvidence = { kind: "choice",
  alternatives: [{ kind: "known", category: "number" }, { kind: "known", category: "absence" }] };
const stringOrAbsence: CategoryEvidence = { kind: "choice",
  alternatives: [{ kind: "known", category: "string" }, { kind: "known", category: "absence" }] };

export const optionalValueDomainOf: OptionalValueDomainOf = (term, typeOf) => {
  if (term.kind !== "optional") return { kind: "not-optional-value" };
  const payload = typeOf(term.value);
  if (payload === null) return { kind: "resource-stop" };
  if (payload.kind === "string")
    return { kind: "optional-value", payload: "string", present: term.value, category: stringOrAbsence };
  if (payload.kind === "primitive" && payload.primitive === "bool")
    return { kind: "optional-value", payload: "boolean", present: term.value, category: booleanOrAbsence };
  if (payload.kind === "primitive" && payload.primitive === "float64")
    return { kind: "optional-value", payload: "float64", present: term.value, category: numberOrAbsence };
  if (payload.kind !== "union" || payload.members.length !== 2) return { kind: "not-optional-value" };
  const [first, second] = payload.members;
  if (first === undefined || second === undefined) return { kind: "not-optional-value" };
  const left = typeOf(first);
  if (left === null) return { kind: "resource-stop" };
  if (left.kind !== "literal" || left.value.kind !== "boolean") return { kind: "not-optional-value" };
  const right = typeOf(second);
  if (right === null) return { kind: "resource-stop" };
  if (right.kind !== "literal" || right.value.kind !== "boolean" || right.base !== left.base
    || right.value.value === left.value.value) return { kind: "not-optional-value" };
  const base = typeOf(left.base);
  if (base === null) return { kind: "resource-stop" };
  return base.kind === "primitive" && base.primitive === "bool"
    ? { kind: "optional-value", payload: "boolean", present: left.base, category: booleanOrAbsence }
    : { kind: "not-optional-value" };
};
