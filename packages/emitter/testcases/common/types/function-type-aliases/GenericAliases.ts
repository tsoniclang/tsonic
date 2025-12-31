import { int } from "@tsonic/core/types.js";

// Generic function type aliases
export type Predicate<T> = (x: T) => boolean;
export type Transform<T, U> = (x: T) => U;
export type Reducer<T, A> = (acc: A, item: T) => A;

// Functions using type aliases
export function filter<T>(arr: T[], pred: Predicate<T>): T[] {
  const result: T[] = [];
  for (const item of arr) {
    if (pred(item)) {
      result.push(item);
    }
  }
  return result;
}

export function mapArray<T, U>(arr: T[], fn: Transform<T, U>): U[] {
  const result: U[] = [];
  for (const item of arr) {
    result.push(fn(item));
  }
  return result;
}
