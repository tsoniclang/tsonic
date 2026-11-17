export const optionalSwitchSource = `
import type { int32, int64, uint64 } from "@tsonic/core/types.js";
let reads: int32 = 0;
function observed(value: string | null | undefined): string | null | undefined { reads++; return value; }
function count(): int32 { return reads; }
function selected(value: string | null | undefined): int32 {
  switch (observed(value)) {
    case observed("one"): return 1;
    default: return 0;
    case observed(undefined): return -1;
    case observed("two"): return 2;
  }
}
export function literal(value: string | undefined): int32 {
  switch (value) {
    case "one": return 1;
    case "two": return 2;
    case "": return 3;
    default: return 0;
  }
}
function grouped(value: string | null | undefined): int32 {
  let total: int32 = 0;
  switch (value) {
    case undefined: total += 1;
    case "": total += 2; break;
    default: total = -1;
  }
  return total;
}
function nullable(value: string | null | undefined): boolean {
  switch (value) { case null: return true; default: return false; }
}
function boolean(value: boolean | undefined): int32 {
  switch (value) { case false: return 1; case true: return 2; default: return 0; }
}
function throughdefault(value: boolean | undefined): int32 {
  let total: int32 = 0;
  switch (value) { case false: total += 1; default: total += 2; case true: total += 4; }
  return total;
}
function signed(value: int64 | undefined): int32 {
  switch (value) { case 9007199254740993n: return 1; case undefined: return 2; default: return 0; }
}
function unsigned(value: uint64 | undefined): int32 {
  switch (value) { case 18446744073709551615n: return 1; case undefined: return 2; default: return 0; }
}
function quotient(numerator: number, denominator: number): number { return numerator / denominator; }
function floating(value: number | undefined): int32 {
  switch (value) { case quotient(0, 0): return 1; case 0: return 2; default: return 3; }
}
export function run(): boolean {
  if (selected("one") !== 1 || count() !== 2 || selected("two") !== 2 || count() !== 6 ||
      selected(undefined) !== -1 || count() !== 9 || selected(null) !== -1 || count() !== 12 ||
      selected("missing") !== 0 || count() !== 16) return false;
  const exact: int64 = 9007199254740993n;
  const maximum: uint64 = 18446744073709551615n;
  return literal("one") === 1 && literal("two") === 2 && literal("") === 3 && literal(undefined) === 0 &&
    grouped(undefined) === 3 && grouped(null) === 3 && grouped("") === 2 && grouped("missing") === -1 &&
    nullable(null) && nullable(undefined) && !nullable("") &&
    boolean(false) === 1 && boolean(true) === 2 && boolean(undefined) === 0 &&
    throughdefault(false) === 7 && throughdefault(undefined) === 6 && throughdefault(true) === 4 &&
    signed(exact) === 1 && signed(exact - 1n) === 0 && signed(undefined) === 2 &&
    unsigned(maximum) === 1 && unsigned(maximum - 1n) === 0 && unsigned(undefined) === 2 &&
    floating(quotient(0, 0)) === 3 && floating(-0) === 2 && floating(undefined) === 3;
}
`;
