import { int } from "@tsonic/core/types.js";

export interface Comparable<T> {
  compareTo(other: T): int;
}

export interface Showable {
  show(): string;
}

// Function with multiple constrained type params
export function maxAndShow<T extends Comparable<T> & Showable>(
  a: T,
  b: T
): string {
  const comparison = a.compareTo(b);
  if (comparison >= 0) {
    return a.show();
  }
  return b.show();
}

// Simple max function with single constraint
export function max<T extends Comparable<T>>(a: T, b: T): T {
  const comparison = a.compareTo(b);
  return comparison >= 0 ? a : b;
}
