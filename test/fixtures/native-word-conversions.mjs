export const nativeWordConversionsSource = `
import type { int16, int32, nativeInt, nativeUint, uint8, uint16 } from "@tsonic/core/types.js";
let reads: int32 = 0;
function read(): int32 { reads += 1; return 7; }
function unsigned(value: int32): nativeUint { return value as nativeUint; }
function signed(value: nativeUint): nativeInt { return value as nativeInt; }
function fromByte(value: uint8): nativeUint { return value; }
function fromWord(value: uint16): nativeUint { return value; }
function fromSigned(value: int16): nativeInt { return value; }
function optional(value: uint16 | undefined): nativeUint | undefined { return value; }
export function run(): boolean {
  const selected = unsigned(read());
  const index = "prefix:suffix".indexOf(":");
  const end: nativeUint = index as nativeUint;
  const start: nativeUint = end + 1;
  const length: uint16 = 65535;
  let cursor: nativeUint = 2;
  cursor += fromWord(length);
  return selected === 7 && reads === 1 && signed(selected) === 7 &&
    fromByte(255) === 255 && fromWord(length) === 65535 && fromSigned(-32768) === -32768 &&
    cursor === 65537 && end === 6 && start === 7 &&
    optional(undefined) === undefined && optional(65535) === 65535;
}
`;
