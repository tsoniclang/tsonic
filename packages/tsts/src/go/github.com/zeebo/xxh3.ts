import type { bool, byte, int } from "@tsonic/core/types.js";
import type { GoError, GoSlice } from "../../compat.js";

export interface Hasher {
  Write(p: GoSlice<byte>): [int, GoError];
  WriteString(s: string): [int, GoError];
  Sum64(): bigint;
  Sum128(): Uint128;
  Reset(): void;
}

export interface Uint128 {
  Hi: bigint;
  Lo: bigint;
  Bytes(): GoSlice<byte>;
  IsZero(): bool;
  String(): string;
}

const offset64: bigint = 14695981039346656037n;
const prime64: bigint = 1099511628211n;
const mask64: bigint = (1n << 64n) - 1n;
const secondSeed: bigint = 0x9e3779b97f4a7c15n;
const encoder = new TextEncoder();

class uint128 implements Uint128 {
  constructor(readonly Hi: bigint, readonly Lo: bigint) {}

  Bytes(): GoSlice<byte> {
    return [...uint64Bytes(this.Hi), ...uint64Bytes(this.Lo)];
  }

  IsZero(): bool {
    return this.Hi === 0n && this.Lo === 0n;
  }

  String(): string {
    return this.Hi.toString(16).padStart(16, "0") + this.Lo.toString(16).padStart(16, "0");
  }
}

const interned = new globalThis.Map<string, Uint128>();

function makeUint128(hi: bigint, lo: bigint): Uint128 {
  const key = hi.toString(16).padStart(16, "0") + lo.toString(16).padStart(16, "0");
  let existing = interned.get(key);
  if (existing === undefined) {
    existing = new uint128(hi, lo);
    interned.set(key, existing);
  }
  return existing;
}

class hasher implements Hasher {
  private hi = offset64 ^ secondSeed;
  private lo = offset64;

  Write(p: GoSlice<byte>): [int, GoError] {
    for (const value of p) {
      const byteValue = BigInt(value & 0xff);
      this.lo ^= byteValue;
      this.lo = (this.lo * prime64) & mask64;
      this.hi ^= byteValue + secondSeed;
      this.hi = (this.hi * prime64) & mask64;
    }
    return [p.length as int, undefined];
  }

  WriteString(s: string): [int, GoError] {
    const bytes = Array.from(encoder.encode(s)) as GoSlice<byte>;
    return this.Write(bytes);
  }

  Sum128(): Uint128 {
    return makeUint128(this.hi, this.lo);
  }

  Sum64(): bigint {
    return this.lo;
  }

  Reset(): void {
    this.hi = offset64 ^ secondSeed;
    this.lo = offset64;
  }
}

export function HashString128(s: string): Uint128 {
  const h = New();
  h.WriteString(s);
  return h.Sum128();
}

export function New(): Hasher {
  return new hasher();
}

function uint64Bytes(value: bigint): GoSlice<byte> {
  const out: GoSlice<byte> = [];
  for (let shift = 56n; shift >= 0n; shift -= 8n) {
    out.push(Number((value >> shift) & 0xffn) as byte);
  }
  return out;
}
