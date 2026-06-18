export type NodeByteSource = string | ArrayLike<number>;

export const toNodeBytes = (value: NodeByteSource): Uint8Array<ArrayBuffer> => {
  const source =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  const copy = new Uint8Array(source.length);
  for (let index = 0; index < source.length; index += 1) {
    copy[index] = source[index] ?? 0;
  }
  return copy;
};

export const concatNodeBytes = (
  values: readonly (NodeByteSource | undefined)[]
): Uint8Array<ArrayBuffer> => {
  const chunks = values
    .filter(
      (value): value is NodeByteSource => value !== undefined
    )
    .map((value) => toNodeBytes(value));
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
};

export const byteArraysEqual = (
  left: Uint8Array,
  right: Uint8Array
): boolean => {
  if (left.byteLength !== right.byteLength) {
    return false;
  }
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
};
