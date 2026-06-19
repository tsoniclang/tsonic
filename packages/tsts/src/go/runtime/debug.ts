import type { byte, int } from "../scalars.js";
import type { GoSlice } from "../compat.js";

export function Stack(): GoSlice<byte> {
  const stack = new globalThis.Error().stack ?? "";
  return Array.from(new TextEncoder().encode(stack)) as GoSlice<byte>;
}

// SetMaxStack sets the maximum amount of memory that can be used by a single
// goroutine stack and returns the previous setting. V8 does not expose a
// runtime-settable stack limit, so this is a no-op host shim (returns 0).
export function SetMaxStack(_bytes: int): int {
  return 0 as int;
}
