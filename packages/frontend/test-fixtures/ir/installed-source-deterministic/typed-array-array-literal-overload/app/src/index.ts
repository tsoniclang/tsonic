import { Uint8Array } from "@fixture/js/uint8-array.js";

export function copyTail(): Uint8Array {
  const copied = new Uint8Array(4);
  copied.set([4, 5], 1);
  return copied;
}
