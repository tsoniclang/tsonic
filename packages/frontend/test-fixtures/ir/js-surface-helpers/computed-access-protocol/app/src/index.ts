import type { int } from "@tsonic/core/types.js";

class Vec {
  [index: number]: number;

  at(index: int): number | undefined {
    return 0;
  }

  set(index: int, value: number): void {}

  read(index: int): number | undefined {
    return this[index];
  }

  write(index: int, value: number): void {
    this[index] = value as byte;
  }
}

class Holder {
  private readonly data: Vec = new Vec();

  read(index: int): number | undefined {
    return this.data[index];
  }

  write(index: int, value: number): void {
    this.data[index] = value;
  }
}

export { Vec, Holder };
