export const genericNumberPredicatesSource = `
import type { int32, uint32, int64, nativeUint } from "@tsonic/core/types.js";
function integer<Value extends number | bigint>(value: Value): boolean { return Number.isInteger(value); }
function safe<Value extends number | bigint>(value: Value): boolean { return Number.isSafeInteger(value); }
function finite<Value extends number | bigint>(value: Value): boolean { return Number.isFinite(value); }
function nan<Value extends number | bigint>(value: Value): boolean { return Number.isNaN(value); }
export function forward<Value extends number | bigint>(value: Value): boolean { return integer(value); }
function positive<Value extends number | bigint>(value: Value): boolean {
  return value >= 0 && 0 <= value && !(value < 0) && !(0 > value) && value !== 0 && 0 !== value;
}
function ordered<Value extends number>(left: Value, right: Value): boolean {
  return left < right && right > left && left <= right && right >= left && left !== right;
}
function valid<Length extends number>(value: Length): Length {
  if (!Number.isInteger(value) || value < 0) throw new Error("invalid length");
  return value;
}
function narrowed(value: int32 | string | undefined): int32 {
  if (value === undefined) return 0;
  if (typeof value === "number") return valid(value);
  return 1;
}
function nativeCount(value: nativeUint | string | undefined): nativeUint {
  if (value === undefined) return 0;
  if (typeof value === "number") return valid(value);
  return 1;
}
export function run(): boolean {
  const signed: int32 = 2147483647;
  const unsigned: uint32 = 4294967295;
  const count: nativeUint = 4294967295;
  const wide: int64 = 9007199254740993n;
  const large = 9007199254740993n;
  const union: number | bigint = large;
  let rejected = false;
  try { valid(1.5); } catch { rejected = true; }
  return valid(signed) === signed && valid(unsigned) === unsigned && valid(7) === 7 &&
    forward(signed) && forward(unsigned) && forward(wide) && forward(large) &&
    integer(union) && !integer(1.5) && !integer(Number.NaN) && !integer(Number.POSITIVE_INFINITY) &&
    safe(signed) && !safe(wide) && !safe(large) && finite(large) && !nan(large) &&
    nan(Number.NaN) && !finite(Number.NEGATIVE_INFINITY) && positive(wide) && positive(large) &&
    positive(unsigned) && !positive(0) && !positive(Number.NaN) && ordered(2, 3) && rejected &&
    narrowed(signed) === signed && narrowed(undefined) === 0 && narrowed("fallback") === 1 &&
    nativeCount(count) === count && nativeCount(undefined) === 0 && nativeCount("fallback") === 1;
}
`;
