export function toNodeBytes(bytes: ArrayLike<number>): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(bytes);
}

export function byteArraysEqual(left: ArrayLike<number>, right: ArrayLike<number>): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}
