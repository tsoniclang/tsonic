import { int } from "@tsonic/core/types.js";

// Generic base class
export class Container<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
  getValue(): T {
    return this.value;
  }
}

// Non-generic extending generic with concrete type
export class IntContainer extends Container<int> {
  double(): int {
    return (this.getValue() * 2) as int;
  }
}

export class StringContainer extends Container<string> {
  getLength(): int {
    return this.getValue().length as int;
  }
}
