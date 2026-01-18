/**
 * Test: ref/out/inref parameter passing modifiers
 *
 * Tests:
 * 1. Defining functions with out<T>, ref<T>, inref<T> parameters
 * 2. Calling functions with `as out<T>`, `as ref<T>`, `as inref<T>` casts
 */

import { Console } from "@tsonic/dotnet/System.js";
import { int, out, ref, inref } from "@tsonic/core/types.js";

// Parameter passing modifiers

// Function with out parameter - caller uses `as out<T>` to pass
function tryDouble(x: int, result: out<int>): boolean {
  result = x * 2;
  return true;
}

// Function with ref parameter - caller uses `as ref<T>` to pass
function increment(x: ref<int>): void {
  x = x + 1;
}

// Function with inref parameter - read-only reference (optimization for large data)
function printValue(x: inref<int>): void {
  Console.WriteLine(`Value: ${x}`);
}

export function main(): void {
  // Test out parameter
  let doubled: int = 0;
  if (tryDouble(21, doubled as out<int>)) {
    Console.WriteLine(`21 doubled is: ${doubled}`);
  }

  // Test ref parameter
  let count: int = 10;
  increment(count as ref<int>);
  Console.WriteLine(`After increment: ${count}`);

  // Test inref parameter (read-only)
  const value: int = 42;
  printValue(value as inref<int>);

  Console.WriteLine("All tests passed!");
}
