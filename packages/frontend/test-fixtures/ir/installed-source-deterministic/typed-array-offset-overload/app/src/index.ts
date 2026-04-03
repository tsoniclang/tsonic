import { Uint8Array } from "@fixture/js/uint8-array.js";

export function leftPadBytes(
  buffer: Uint8Array,
  length: number
): Uint8Array {
  if (buffer.length >= length) {
    return buffer;
  }

  const result = new Uint8Array(length);
  result.set(buffer, length - buffer.length);
  return result;
}
