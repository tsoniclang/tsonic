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
    const val: int = this.value;
    return (val * 2) as int;
  }
}

class StringContainer extends Container<string> {
  constructor(value: string) {
    super(value);
  }
  getLength(): int {
    const s: string = this.value;
    return s.length as int;
  }
}

// Test usage
export function main(): void {
  const intBox = new IntContainer(42 as int);
  Console.writeLine(`Value: ${intBox.getValue()}`);
  Console.writeLine(`Doubled: ${intBox.double()}`);

  const strBox = new StringContainer("hello");
  Console.writeLine(`String: ${strBox.getValue()}`);
  Console.writeLine(`Length: ${strBox.getLength()}`);
}
