import type { TypePatternMatch } from "./contract.js";
import type { LiteralTypeValue, TypeTerm } from "../ir-types/contract.js";
import { literalTypeValuesEqual } from "../ir-types/index.js";
import { notDecidedYet } from "./frontier.js";

function atomOf(term: TypeTerm): LiteralTypeValue | "symbol" | null {
  if (term.kind === "intrinsic" && term.intrinsic === "symbol") return "symbol";
  if (term.kind === "literal" && (term.value.kind === "boolean" || term.value.kind === "string" || term.value.kind === "unique-symbol"))
    return term.value;
  return null;
}

export const matchTypePattern: TypePatternMatch = (value, required) => {
  const check = atomOf(value);
  const pattern = atomOf(required);
  if (check === null || pattern === null)
    return notDecidedYet("noncoercive type matching outside the supported atomic domain", null);
  if (pattern === "symbol") return check === "symbol" || check.kind === "unique-symbol" ? "match" : "no-match";
  return check !== "symbol" && literalTypeValuesEqual(check, pattern) ? "match" : "no-match";
};
