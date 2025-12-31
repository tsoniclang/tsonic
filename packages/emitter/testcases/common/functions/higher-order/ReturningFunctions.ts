import { int } from "@tsonic/core/types.js";

// Curried: (A) => (B) => C
export function add(a: int): (b: int) => int {
  return b => a + b;
}

// Double nested: (T) => () => T
export function makeRepeater(value: string): () => string {
  return () => value;
}

// Triple nested: () => () => () => T
export function createNested(): () => () => string {
  return () => () => "deeply nested";
}
