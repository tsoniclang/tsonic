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
  return calls === 4 && skippedAnd === false && skippedOr === true && selectedAnd === 7 && selectedOr === 7 &&
    (enabled ? andValue === 7 && orValue === true && absentAnd == null && absentOr === true && selectedWide === wide
      : andValue === false && orValue === 7 && absentAnd === false && absentOr == null && selectedWide === false);
}
`;
