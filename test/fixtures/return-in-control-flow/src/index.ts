/**
 * Return in Control Flow Threading E2E Test
 *
 * Tests that expectedType threads through return statements in:
 * - if/else branches
 * - while loops
 * - for loops
 * - switch cases
 * - try/catch blocks
 */

import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

// Return in if branch - should use int division
function getInIf(condition: boolean): int {
  if (condition) {
    return 7 / 2; // Should be 3 (int division), not 3.5
  }
  return 100;
}

// Return in else branch
function getInElse(condition: boolean): int {
  if (condition) {
    return 10;
  } else {
    return 9 / 2; // Should be 4 (int division)
  }
}

// Return in while loop
function getInWhile(count: int): int {
  while (count > 0) {
    return 15 / 4; // Should be 3 (int division)
  }
  return 0;
}

// Return in for loop
function getInFor(): int {
  for (let i = 0; i < 10; i++) {
    return 11 / 3; // Should be 3 (int division)
  }
  return 0;
}

// Return in switch case
function getInSwitch(key: int): int {
  switch (key) {
    case 1:
      return 13 / 4; // Should be 3 (int division)
    case 2:
      return 17 / 5; // Should be 3 (int division)
    default:
      return 19 / 6; // Should be 3 (int division)
  }
}

// Nested control flow
function getInNestedIf(a: boolean, b: boolean): int {
  if (a) {
    if (b) {
      return 21 / 7; // Should be 3 (int division)
    }
    return 100;
  }
  return 200;
}

// Return with nullish coalescing - using ?? instead of if/null check
function getWithNullish(value: int | null): int {
  return value ?? 25 / 2; // Should be 12 (int division if null)
}

export function main(): void {
  Console.writeLine("=== Return in Control Flow E2E Tests ===");
  Console.writeLine("");

  // Test if branch - 7/2 = 3 (int division)
  const r1 = getInIf(true);
  Console.writeLine(`getInIf(true) = ${r1}`); // 3

  // Test else branch - 9/2 = 4 (int division)
  const r2 = getInElse(false);
  Console.writeLine(`getInElse(false) = ${r2}`); // 4

  // Test while - 15/4 = 3 (int division)
  const r3 = getInWhile(1);
  Console.writeLine(`getInWhile(1) = ${r3}`); // 3

  // Test for - 11/3 = 3 (int division)
  const r4 = getInFor();
  Console.writeLine(`getInFor() = ${r4}`); // 3

  // Test switch case 1 - 13/4 = 3 (int division)
  const r5 = getInSwitch(1);
  Console.writeLine(`getInSwitch(1) = ${r5}`); // 3

  // Test switch case 2 - 17/5 = 3 (int division)
  const r6 = getInSwitch(2);
  Console.writeLine(`getInSwitch(2) = ${r6}`); // 3

  // Test switch default - 19/6 = 3 (int division)
  const r7 = getInSwitch(99);
  Console.writeLine(`getInSwitch(99) = ${r7}`); // 3

  // Test nested if - 21/7 = 3 (int division)
  const r8 = getInNestedIf(true, true);
  Console.writeLine(`getInNestedIf(true, true) = ${r8}`); // 3

  // Test with nullish - 25/2 = 12 (int division)
  const r9 = getWithNullish(null);
  Console.writeLine(`getWithNullish(null) = ${r9}`); // 12

  Console.writeLine("");
  Console.writeLine("=== All tests completed ===");
}
