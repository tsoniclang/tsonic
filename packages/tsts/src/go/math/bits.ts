import type { int, uint } from "@tsonic/core/types.js";

export function OnesCount(x: uint): int {
  let value = BigInt(x as number);
  let count = 0;
  while (value !== 0n) {
    count += Number(value & 1n);
    value >>= 1n;
  }
  return count as int;
}

export function OnesCount32(x: uint): int {
  let value = (x as number) >>> 0;
  value = value - ((value >>> 1) & 0x55555555);
  value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
  return (((value + (value >>> 4)) & 0x0f0f0f0f) * 0x01010101 >>> 24) as int;
}
