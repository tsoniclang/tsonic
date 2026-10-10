export const nativeParsingRadixSource = `
import type { int32 } from "@tsonic/core/types.js";

function floating(value: number): number {
  return parseInt("10", value) + Number.parseInt("10", value);
}

function integer(value: int32): number {
  return parseInt("10", value) + Number.parseInt("10", value);
}

function optional(value: number | undefined): number {
  return parseInt("0x10", value) + Number.parseInt("0x10", value);
}

function optionalInteger(value: int32 | undefined): number {
  return parseInt("10", value) + Number.parseInt("10", value);
}

export function run(): boolean {
  return floating(2.9) === 4 && floating(4294967298) === 4 &&
    floating(Number.NaN) === 20 && floating(Number.POSITIVE_INFINITY) === 20 &&
    integer(2) === 4 && optional(undefined) === 32 && optional(16) === 32 &&
    optionalInteger(undefined) === 20 && optionalInteger(2) === 4 &&
    parseInt("0x10", undefined) === 16 && Number.parseInt("0x10", undefined) === 16 &&
    parseInt("0x10") === 16 && Number.parseInt("0x10") === 16 &&
    Number.isNaN(parseInt("10", 1.9)) && Number.isNaN(Number.parseInt("10", 37));
}
`;
