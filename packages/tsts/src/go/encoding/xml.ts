import type { GoError } from "../compat.js";
import type { Reader } from "../io.js";

export class Decoder {
  constructor(private readonly source: Reader | string | Uint8Array) {}

  Decode(target: { value?: string } | undefined): GoError {
    const text = sourceToString(this.source);
    if (target !== undefined) {
      target.value = text;
    }
    return undefined;
  }
}

export function NewDecoder(source: Reader | string | Uint8Array): Decoder {
  return new Decoder(source);
}

function sourceToString(source: Reader | string | Uint8Array): string {
  if (typeof source === "string") {
    return source;
  }
  if (source instanceof Uint8Array) {
    return new TextDecoder().decode(source);
  }
  return "";
}
