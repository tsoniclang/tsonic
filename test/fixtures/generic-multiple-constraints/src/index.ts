import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

interface Comparable<T> {
  compareTo(other: T): int;
}

interface Showable {
  show(): string;
}

class NumberValue implements Comparable<NumberValue>, Showable {
  value: int;
  constructor(value: int) {
    this.value = value;
  }
  compareTo(other: NumberValue): int {
    return this.value - other.value;
  }
  show(): string {
    return `Number(${this.value})`;
  }
}

// Function with multiple constrained type params
function maxAndShow<T extends Comparable<T> & Showable>(a: T, b: T): string {
  const comparison = a.compareTo(b);
  if (comparison >= 0) {
    return a.show();
  }
  return b.show();
}

// Simple max function with single constraint
function max<T extends Comparable<T>>(a: T, b: T): T {
  const comparison = a.compareTo(b);
  return comparison >= 0 ? a : b;
}

export function main(): void {
  const a = new NumberValue(10);
  const b = new NumberValue(20);

  Console.writeLine(`Max: ${maxAndShow(a, b)}`);

  const maxVal = max(a, b);
  Console.writeLine(`Max value: ${maxVal.value}`);
}
