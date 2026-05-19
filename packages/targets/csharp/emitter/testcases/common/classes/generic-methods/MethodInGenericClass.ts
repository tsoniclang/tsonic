import { int } from "@tsonic/core/types.js";

export class Transformer<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }

  // Generic method with own type param
  map<U>(fn: (x: T) => U): Transformer<U> {
    return new Transformer(fn(this.value));
  }

  // Generic method using class type param
  combine(other: Transformer<T>, fn: (a: T, b: T) => T): Transformer<T> {
    return new Transformer(fn(this.value, other.value));
  }
}
