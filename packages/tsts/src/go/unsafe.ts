import type { byte, int } from "./scalars.js";
import type { GoPtr, GoSlice, GoUnsafePointer } from "./compat.js";

export function Pointer<T>(value: GoPtr<T>): GoUnsafePointer {
  return value as GoUnsafePointer;
}

export function Slice<T>(ptr: GoPtr<T> | ArrayLike<T>, len: int): GoSlice<T> {
  const length = len as number;
  if (length < 0) {
    throw new globalThis.Error("unsafe.Slice: len out of range");
  }
  if (ptr === undefined || ptr === null) {
    if (length === 0) {
      return [];
    }
    throw new globalThis.Error("unsafe.Slice: ptr is nil and len is not zero");
  }
  if (typeof ptr === "object" && "length" in ptr) {
    return globalThis.Array.prototype.slice.call(ptr, 0, length) as GoSlice<T>;
  }
  return length === 0 ? [] : [ptr as T];
}

export function String(ptr: GoPtr<byte> | ArrayLike<byte>, len: int): string {
  const bytes = Slice(ptr, len);
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

export function StringData(value: string): GoPtr<byte> {
  return new TextEncoder().encode(value)[0] as GoPtr<byte>;
}
