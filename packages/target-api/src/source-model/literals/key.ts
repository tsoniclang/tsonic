import type { Node } from "@tsonic/tsts";
import { sourceLiteralUnitsEqual, type SourceLiteralUnit } from "./domain.js";
import type { SourceNumericLiteralToken } from "./token.js";

export type SourceLiteralKey =
  | { readonly kind: "name"; readonly name: string }
  | { readonly kind: "symbol"; readonly declaration: Node };

function numericName(token: SourceNumericLiteralToken): string {
  if (token.coefficient === 0n) return "0";
  const coefficient = token.coefficient.toString();
  const digits = coefficient.replace(/0+$/u, "");
  const point = BigInt(coefficient.length) + token.exponent;
  const prefix = token.negative ? "-" : "";
  if (point > 0n && point <= 21n) {
    const position = Number(point);
    return prefix + (position >= digits.length ? digits.padEnd(position, "0")
      : `${digits.slice(0, position)}.${digits.slice(position)}`);
  }
  if (point <= 0n && point >= -5n) return `${prefix}0.${"0".repeat(Number(-point))}${digits}`;
  const exponent = point - 1n;
  return `${prefix}${digits[0]}${digits.length === 1 ? "" : `.${digits.slice(1)}`}e${exponent < 0n ? "" : "+"}${exponent}`;
}

export function sourceLiteralUnitKey(unit: SourceLiteralUnit): SourceLiteralKey | undefined {
  if (unit.kind === "symbol") return Object.freeze({ kind: "symbol", declaration: unit.declaration });
  if (unit.kind === "string") return Object.freeze({ kind: "name", name: unit.value });
  if (unit.kind !== "number") return undefined;
  const value = unit.value;
  const name = value.kind === "authored" ? numericName(value.token)
    : value.kind === "integer" ? value.value.toString()
    : Number.isFinite(value.value) ? String(value.value) : undefined;
  return name === undefined ? undefined : Object.freeze({ kind: "name", name });
}

type SourceNumericKeyValue = Extract<SourceLiteralUnit, { readonly kind: "number" }>["value"];

function negativeZero(value: SourceNumericKeyValue): boolean {
  return value.kind === "checked-float64" ? Object.is(value.value, -0)
    : value.kind === "authored" && value.token.coefficient === 0n && value.token.negative;
}

export function sourceNumericKeyValuesEqual(left: SourceNumericKeyValue, right: SourceNumericKeyValue): boolean {
  return negativeZero(left) === negativeZero(right) && sourceLiteralUnitsEqual({ kind: "number", value: left }, { kind: "number", value: right });
}
