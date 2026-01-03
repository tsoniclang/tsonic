// Entry point using generators from multiple modules
// This tests that Tsonic.Runtime.IteratorResult<T> resolves correctly
// across separate modules without collisions

import { Console } from "@tsonic/dotnet/System.js";
import { counter } from "./counter-gen.js";
import { accumulator } from "./accumulator-gen.js";

export function main(): void {
  // Test counter generator (returns string)
  Console.writeLine("=== Counter Generator ===");
  const cnt = counter(10.0);
  const c1 = cnt.next();
  Console.writeLine(`c1: ${c1.value}, done: ${c1.done}`);
  const c2 = cnt.next(5);
  Console.writeLine(`c2: ${c2.value}, done: ${c2.done}`);
  const c3 = cnt.next(3);
  Console.writeLine(`c3: ${c3.value}, done: ${c3.done}`);
  const c4 = cnt.next(2);
  Console.writeLine(`c4: done=${c4.done}`);
  // Note: cnt.returnValue is our C# extension, not in TS standard types

  // Test accumulator generator (returns number)
  Console.writeLine("=== Accumulator Generator ===");
  const acc = accumulator(100.0);
  const a1 = acc.next();
  Console.writeLine(`a1: ${a1.value}, done: ${a1.done}`);
  const a2 = acc.next(50);
  Console.writeLine(`a2: ${a2.value}, done: ${a2.done}`);
  const a3 = acc.next(25);
  Console.writeLine(`a3: ${a3.value}, done: ${a3.done}`);
  const a4 = acc.next(10);
  Console.writeLine(`a4: done=${a4.done}`);
  // Note: acc.returnValue is our C# extension, not in TS standard types
}
