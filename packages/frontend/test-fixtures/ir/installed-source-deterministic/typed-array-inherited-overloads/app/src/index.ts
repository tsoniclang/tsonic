import { Uint8Array } from "@fixture/js/uint8-array.js";

export function concatBytes(...buffers: Uint8Array[]): Uint8Array {
  let totalLength = 0;
  for (let index = 0; index < buffers.length; index += 1) {
    totalLength += buffers[index]!.length;
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (let index = 0; index < buffers.length; index += 1) {
    const buffer = buffers[index]!;
    result.set(buffer, offset);
    offset += buffer.length;
  }
  return result;
}
