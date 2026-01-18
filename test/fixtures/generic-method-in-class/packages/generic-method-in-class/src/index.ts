import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

class Transformer<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }

  // Generic method with own type param
  map<U>(fn: (x: T) => U): Transformer<U> {
    return new Transformer<U>(fn(this.value));
  }

  // Generic method using class type param
  combine(other: Transformer<T>, fn: (a: T, b: T) => T): Transformer<T> {
    return new Transformer<T>(fn(this.value, other.value));
  }
}

export function main(): void {
  const t1 = new Transformer(5);
  const t2 = t1.map((x) => `Value: ${x}`);
  Console.WriteLine(t2.value);

  const t3 = new Transformer(10);
  const combined = t1.combine(t3, (a, b) => a + b);
  Console.WriteLine(`Combined: ${combined.value}`);
}
