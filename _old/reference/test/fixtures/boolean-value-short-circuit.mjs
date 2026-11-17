export const booleanValueShortCircuitSource = `
import type { int32, uint64 } from "@tsonic/core/types.js";
export function chooseAnd(enabled: boolean, value: int32 | undefined): boolean | int32 | undefined {
  return enabled && value;
}
export function chooseOr(enabled: boolean, value: int32 | undefined): boolean | int32 | undefined {
  return enabled || value;
}
export function wideAnd(enabled: boolean, value: uint64): boolean | uint64 {
  return enabled && value;
}
export function guardedAnd(value: boolean | undefined): boolean {
  return value !== undefined && value;
}
export function guardedOr(value: boolean | undefined): boolean {
  return value === undefined || value;
}
export function guardedNull(value: boolean | null | undefined): boolean {
  return value != null && value;
}
export function projectedConditions(value: boolean | undefined): int32 {
  let count: int32 = 0;
  if (value !== undefined) {
    if (value) count++;
    while (value) { count++; if (count === 3) break; }
    do { if (value) count++; } while (value && count < 4);
    for (; value;) { count++; if (count === 6) break; }
    const selected = value && (7 as int32);
    if (selected === 7) count++;
  }
  return count;
}
export function run(enabled: boolean): boolean {
  let calls = 0 as int32;
  function next(): int32 { calls++; return 7 as int32; }
  const andValue = enabled && next();
  const orValue = enabled || next();
  const skippedAnd = false && next();
  const skippedOr = true || next();
  const selectedAnd = true && next();
  const selectedOr = (next(), false) || next();
  const absentAnd = chooseAnd(enabled, undefined);
  const absentOr = chooseOr(enabled, undefined);
  const wide: uint64 = 9007199254740993n;
  const selectedWide = wideAnd(enabled, wide);
  return guardedAnd(true) && !guardedAnd(false) && !guardedAnd(undefined) &&
    guardedOr(true) && !guardedOr(false) && guardedOr(undefined) &&
    guardedNull(true) && !guardedNull(false) && !guardedNull(null) && !guardedNull(undefined) &&
    projectedConditions(true) === 7 && projectedConditions(false) === 0 && projectedConditions(undefined) === 0 &&
    calls === 4 && skippedAnd === false && skippedOr === true && selectedAnd === 7 && selectedOr === 7 &&
    (enabled ? andValue === 7 && orValue === true && absentAnd == null && absentOr === true && selectedWide === wide
      : andValue === false && orValue === 7 && absentAnd === false && absentOr == null && selectedWide === false);
}
`;
