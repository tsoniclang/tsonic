import { int } from "@tsonic/core/types.js";

export class Wrapper<T> {
  inner: T;
  constructor(inner: T) {
    this.inner = inner;
  }
}

export class Container<T> {
  wrapped: Wrapper<T>;
  constructor(value: T) {
    this.wrapped = new Wrapper(value);
  }
  getInner(): T {
    return this.wrapped.inner;
  }
}

// Concrete instantiation - should substitute T=int through Wrapper<T>
export class IntContainer extends Container<int> {
  addOne(): int {
    return this.getInner() + 1;
  }
}
