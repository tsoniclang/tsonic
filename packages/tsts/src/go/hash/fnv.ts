import type { byte, int } from "../scalars.js";
import type { GoError, GoSlice } from "../compat.js";

const offset64 = 14695981039346656037n;
const prime64 = 1099511628211n;
const mask64 = (1n << 64n) - 1n;

export interface Hash64 {
  Write(p: GoSlice<byte>): [int, GoError];
  Sum64(): bigint;
  Sum(p: GoSlice<byte>): GoSlice<byte>;
  Reset(): void;
}

class fnv64a implements Hash64 {
  private value = offset64;

  Write(p: GoSlice<byte>): [int, GoError] {
    for (const byteValue of p) {
      this.value ^= BigInt(byteValue & 0xff);
      this.value = (this.value * prime64) & mask64;
    }
    return [p.length as int, undefined];
  }

  Sum64(): bigint {
    return this.value;
  }

  Sum(p: GoSlice<byte>): GoSlice<byte> {
    const output = p.slice();
    for (let shift = 56n; shift >= 0n; shift -= 8n) {
      output.push(Number((this.value >> shift) & 0xffn) as byte);
    }
    return output;
  }

  Reset(): void {
    this.value = offset64;
  }
}

export function New64a(): Hash64 {
  return new fnv64a();
}
