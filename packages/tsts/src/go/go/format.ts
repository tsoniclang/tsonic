import type { byte } from "../scalars.js";
import type { GoError, GoSlice } from "../compat.js";
import type { Writer } from "../io.js";
import { Sprint } from "../fmt.js";

export function Node(dst: Writer, _fset: unknown, node: unknown): GoError {
  const text = typeof node === "string" ? node : Sprint(node);
  const [, err] = dst.Write(Array.from(new TextEncoder().encode(text)) as GoSlice<byte>);
  return err;
}

export function Source(src: GoSlice<byte> | Uint8Array | string): [GoSlice<byte>, GoError] {
  if (typeof src === "string") {
    return [Array.from(new TextEncoder().encode(src)) as GoSlice<byte>, undefined];
  }
  return [Array.from(src) as GoSlice<byte>, undefined];
}
