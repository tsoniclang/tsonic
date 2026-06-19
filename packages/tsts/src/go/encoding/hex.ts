import type { byte } from "../scalars.js";
import type { GoSlice } from "../compat.js";

export function EncodeToString(source: GoSlice<byte> | Uint8Array): string {
  let output = "";
  for (const value of source) {
    output += (value & 0xff).toString(16).padStart(2, "0");
  }
  return output;
}
