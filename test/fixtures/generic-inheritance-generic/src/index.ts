import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

// Base generic
class Box<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}

// Generic extending generic (same type param)
class LabeledBox<T> extends Box<T> {
  label: string;
  constructor(value: T, label: string) {
    super(value);
    this.label = label;
  }
  describe(): string {
    return `${this.label}: ${this.value}`;
  }
}

// Generic extending generic (different type param name)
class WrappedBox<U> extends Box<U> {
  wrap(): Box<U> {
    return new Box(this.value);
  }
}

// Test
export function main(): void {
  const labeled = new LabeledBox<int>(100 as int, "count");
  Console.writeLine(labeled.describe());

  const wrapped = new WrappedBox<string>("inner");
  Console.writeLine(`Wrapped: ${wrapped.wrap().value}`);
}
