import type { byte } from "@tsonic/core/types.js";
import type { GoError, GoSlice } from "../compat.js";

const textDecoder = new TextDecoder();

export function Unmarshal(data: GoSlice<byte>, out: unknown): GoError {
  try {
    assignDecoded(out, JSON.parse(textDecoder.decode(Uint8Array.from(data as Array<number>))));
    return undefined;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

const assignDecoded = (out: unknown, value: unknown): void => {
  if (out === undefined || out === null) {
    return;
  }
  if (Array.isArray(out) && Array.isArray(value)) {
    out.splice(0, out.length, ...value);
    return;
  }
  if (typeof out === "object" && typeof value === "object" && value !== null) {
    Object.assign(out, value);
  }
}
