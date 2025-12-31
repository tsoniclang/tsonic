import { int } from "@tsonic/core/types.js";

// Generic function type aliases
export type Predicate<T> = (x: T) => boolean;
export type Transform<T, U> = (x: T) => U;
export type Comparer<T> = (a: T, b: T) => int;

// Functions using type aliases
export function test<T>(value: T, pred: Predicate<T>): boolean {
  return pred(value);
}

export function transform<T, U>(value: T, fn: Transform<T, U>): U {
  return fn(value);
}

export function compare<T>(a: T, b: T, cmp: Comparer<T>): int {
  return cmp(a, b);
}
