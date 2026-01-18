import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

// Generic base class
class Container<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
  getValue(): T {
    return this.value;
  }
}

// Non-generic extending generic with concrete type
class IntContainer extends Container<int> {
  constructor(value: int) {
    super(value);
  }
  double(): int {
    return this.value * 2;
  }
}

class StringContainer extends Container<string> {
  constructor(value: string) {
    super(value);
  }
  getLength(): int {
    return this.value.Length;
  }
}

// Test usage
export function main(): void {
  const intBox = new IntContainer(42);
  Console.WriteLine(`Value: ${intBox.getValue()}`);
  Console.WriteLine(`Doubled: ${intBox.double()}`);

  const strBox = new StringContainer("hello");
  Console.WriteLine(`String: ${strBox.getValue()}`);
  Console.WriteLine(`Length: ${strBox.getLength()}`);
}
