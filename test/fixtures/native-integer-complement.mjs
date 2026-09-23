export const nativeIntegerComplementSource = `
import type { int8, uint8, int16, uint16, int32, uint32, int64, uint64 } from "@tsonic/core/types.js";
function signed8(value: int8): int32 { return ~(value as int32); }
function unsigned8(value: uint8): int32 { return ~(value as int32); }
function signed16(value: int16): int32 { return ~(value as int32); }
function unsigned16(value: uint16): int32 { return ~(value as int32); }
function signed32(value: int32): int32 { return ~value; }
function unsigned32(value: uint32): uint32 { return ~value; }
function signed64(value: int64): int64 { return ~value; }
function unsigned64(value: uint64): uint64 { return ~value; }
export function run(): boolean {
  return signed8(-1) === 0 && unsigned8(255) === -256 &&
    signed16(-32768) === 32767 && unsigned16(65535) === -65536 &&
    signed32(-2147483648) === 2147483647 && unsigned32(0) === 4294967295 &&
    signed64(-9223372036854775808n) === 9223372036854775807n &&
    unsigned64(0n) === 18446744073709551615n &&
    unsigned64(9223372036854775808n) === 9223372036854775807n;
}
`;
