import { int } from "@tsonic/core/types.js";

// Base class for comparable + showable
export class ComparableShowable<T> {
  compareTo(other: T): int {
    return 0;
  }
  show(): string {
    return "";
  }
}

// Function with single constraint (combined base class)
export function maxAndShow<T extends ComparableShowable<T>>(
  a: T,
  b: T
): string {
  const comparison = a.compareTo(b);
  if (comparison >= 0) {
    return a.show();
  }
  return b.show();
}

// Concrete example
export class NumberValue extends ComparableShowable<NumberValue> {
  value: int;
  constructor(value: int) {
    super();
    this.value = value;
  }
  compareTo(other: NumberValue): int {
    return this.value - other.value;
  }
  show(): string {
    return `Value: ${this.value}`;
  }
}
