import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

// Curried: (A) => (B) => C
function add(a: int): (b: int) => int {
  return (b: int): int => (a + b) as int;
}

// Double nested: (T) => () => T
function makeRepeater(value: string): () => string {
  return (): string => value;
}

// Triple nested: () => () => () => T
function createNested(): () => () => string {
  return (): (() => string) => (): string => "deeply nested";
}

// Curried with 3 params: (A) => (B) => (C) => D
function multiply3(a: int): (b: int) => (c: int) => int {
  return (b: int): ((c: int) => int) =>
    (c: int): int =>
      (((a * b) as int) * c) as int;
}

export function main(): void {
  // Curried add
  const add5 = add(5 as int);
  Console.writeLine(`5 + 3 = ${add5(3 as int)}`);
  Console.writeLine(`5 + 7 = ${add5(7 as int)}`);

  // Repeater
  const repeater = makeRepeater("hello");
  Console.writeLine(`Repeat: ${repeater()}`);

  // Triple nested
  const nested: () => () => string = createNested();
  const level2: () => string = nested();
  const result: string = level2();
  Console.writeLine(`Nested: ${result}`);

  // 3-level curry
  const mult2: (b: int) => (c: int) => int = multiply3(2 as int);
  const mult2x3: (c: int) => int = mult2(3 as int);
  const mult2x3x4: int = mult2x3(4 as int);
  Console.writeLine(`2 * 3 * 4 = ${mult2x3x4}`);
}
