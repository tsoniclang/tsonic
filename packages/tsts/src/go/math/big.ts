import type { int } from "@tsonic/core/types.js";

export class Int {
  private value: bigint;

  constructor(value: bigint | number | string = 0n) {
    this.value = BigInt(value);
  }

  Set(x: Int): Int {
    this.value = x.value;
    return this;
  }

  SetInt64(x: bigint | number): Int {
    this.value = BigInt(x);
    return this;
  }

  Int64(): bigint {
    return this.value;
  }

  Sign(): int {
    return (this.value < 0n ? -1 : this.value > 0n ? 1 : 0) as int;
  }

  Cmp(y: Int): int {
    return (this.value < y.value ? -1 : this.value > y.value ? 1 : 0) as int;
  }

  Add(x: Int, y: Int): Int {
    this.value = x.value + y.value;
    return this;
  }

  Sub(x: Int, y: Int): Int {
    this.value = x.value - y.value;
    return this;
  }

  Mul(x: Int, y: Int): Int {
    this.value = x.value * y.value;
    return this;
  }

  Quo(x: Int, y: Int): Int {
    this.value = x.value / y.value;
    return this;
  }

  Rem(x: Int, y: Int): Int {
    this.value = x.value % y.value;
    return this;
  }

  String(): string {
    return this.value.toString();
  }
}

export class Float {
  constructor(readonly value = 0) {}

  String(): string {
    return String(this.value);
  }
}

export function NewInt(value: bigint | number): Int {
  return new Int(value);
}
