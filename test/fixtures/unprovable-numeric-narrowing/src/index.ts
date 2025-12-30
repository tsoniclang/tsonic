// NEGATIVE TEST: Unprovable numeric narrowings
// This tests that the numeric proof pass correctly rejects narrowings
// that cannot be proven sound at compile time.

import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

export function main(): void {
  // ERROR: Cannot prove narrowing of a floating-point literal to Int32
  // The literal 3.14 is not an integer and cannot be narrowed to int
  const floatAsInt = 3.14 as int; // Should fail: float literal to int
  Console.writeLine(`floatAsInt = ${floatAsInt}`);

  // ERROR: Cannot prove narrowing of an untyped parameter to Int32
  // The parameter x has no proven numeric kind
  const result = unsafeNarrow(10);
  Console.writeLine(`result = ${result}`);
}

// This function receives a number and tries to narrow it to int
// without any proof that it's actually an integer
function unsafeNarrow(x: number): int {
  // ERROR: x is just 'number', not proven to be Int32
  return x as int;
}
