import type { int } from "@tsonic/core/types.js";

abstract class VecBase<T> {
  [index: number]: T;

  public at(index: int): T | undefined {
    void index;
    return undefined;
  }

  public set(index: int, value: T): void {
    void index;
    void value;
  }
}

class Vec extends VecBase<number> {}

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
