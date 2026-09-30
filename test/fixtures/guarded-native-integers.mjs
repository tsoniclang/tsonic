export const guardedNativeIntegerSource = `
import type { int64, uint64, nativeInt, nativeUint } from "@tsonic/core/types.js";
function wide(value: int64, length: uint64): uint64 {
  if (value < 0n) return 0n;
  return value + length;
}
function index(value: nativeInt, length: nativeUint): nativeUint {
  if (value < 0) return 0;
  return length + value;
}
function branch(value: int64, length: uint64): uint64 {
  if (value >= 0n) return value + length;
  return 0n;
}
function unsigned(value: uint64): uint64 { return value; }
function storage(value: int64): uint64 {
  if (value < 0n) return 0n;
  const selected: uint64 = value;
  return unsigned(selected);
}
function argument(value: int64): uint64 {
  if (value < 0n) return 0n;
  return unsigned(value);
}
function returned(value: int64): uint64 {
  if (value < 0n) return 0n;
  return value;
}
export function run(): boolean {
  return wide(-1n, 1n) === 0n && index(-1, 1) === 0 && index(4, 7) === 11 &&
    wide(4n, 9007199254740993n) === 9007199254740997n &&
    branch(1n, 18446744073709551614n) === 18446744073709551615n &&
    storage(9007199254740993n) === 9007199254740993n &&
    argument(9007199254740993n) === 9007199254740993n && returned(9007199254740993n) === 9007199254740993n;
}
`;

export const unguardedNativeIntegerSource = `
import type { int64, uint64 } from "@tsonic/core/types.js";
export function run(value: int64, length: uint64): uint64 { return value + length; }
`;
