import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

// Curried: (A) => (B) => C
function add(a: int): (b: int) => int {
  return (b) => a + b;
}

// Double nested: (T) => () => T
function makeRepeater(value: string): () => string {
  return () => value;
}

// Triple nested: () => () => () => T
function createNested(): () => () => string {
  return () => () => "deeply nested";
}

// Curried with 3 params: (A) => (B) => (C) => D
function multiply3(a: int): (b: int) => (c: int) => int {
  return (b) => (c) => a * b * c;
}

export function main(): void {
  // Curried add
  const add5 = add(5);
  Console.writeLine(`5 + 3 = ${add5(3)}`);
  Console.writeLine(`5 + 7 = ${add5(7)}`);

  // Repeater
  const repeater = makeRepeater("hello");
  Console.writeLine(`Repeat: ${repeater()}`);

  // Triple nested
  const nested = createNested();
  const level2 = nested();
  const result = level2();
  Console.writeLine(`Nested: ${result}`);

  // 3-level curry
  const mult2 = multiply3(2);
  const mult2x3 = mult2(3);
  const mult2x3x4 = mult2x3(4);
  Console.writeLine(`2 * 3 * 4 = ${mult2x3x4}`);
}
