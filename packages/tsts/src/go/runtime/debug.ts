import type { byte } from "@tsonic/core/types.js";
import type { GoSlice } from "../compat.js";

export function Stack(): GoSlice<byte> {
  const stack = new globalThis.Error().stack ?? "";
  return Array.from(new TextEncoder().encode(stack)) as GoSlice<byte>;
}
