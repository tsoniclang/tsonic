import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

class Wrapper<T> {
  inner: T;
  constructor(inner: T) {
    this.inner = inner;
  }
}

class Container<T> {
  wrapped: Wrapper<T>;
  constructor(value: T) {
    this.wrapped = new Wrapper<T>(value);
  }
  getInner(): T {
    return this.wrapped.inner;
  }
}

// Concrete instantiation - should substitute T=int through Wrapper<T>
class IntContainer extends Container<int> {
  constructor(value: int) {
    super(value);
  }
  addOne(): int {
    const inner: int = this.getInner();
    return (inner + 1) as int;
  }
}

export function main(): void {
  const c = new IntContainer(10 as int);
  Console.writeLine(`Inner: ${c.getInner()}`);
  Console.writeLine(`Plus one: ${c.addOne()}`);
}
