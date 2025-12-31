import { int } from "@tsonic/core/types.js";

// Curried: (A) => (B) => C
export function add(a: int): (b: int) => int {
  return (b: int): int => (a + b) as int;
}

// Double nested: (T) => () => T
export function makeRepeater(value: string): () => string {
  return (): string => value;
}

// Triple nested: () => () => () => T
export function createNested(): () => () => string {
  return (): (() => string) => (): string => "deeply nested";
}
